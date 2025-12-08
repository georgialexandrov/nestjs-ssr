# Clean Architecture

How NestJS SSR respects Clean Architecture principles and maintains proper separation of concerns.

## The Core Principle

This library follows a fundamental architectural truth: **React is a view layer, not your application**.

In Clean Architecture terms:

- **Inner circles** (Domain, Use Cases) contain your business logic
- **Controllers** orchestrate use cases and prepare data
- **React components** are the outer circle - web adapters that receive and display data

Your business logic should never depend on React. React depends on your business logic.

## Clean Architecture Layers

```
┌─────────────────────────────────────────────┐
│   Views (React Components)                  │  ← Outer Circle
│   - Display data as props                   │
│   - Handle user interactions                │
│   - No business logic                       │
├─────────────────────────────────────────────┤
│   Controllers                                │  ← Interface Adapters
│   - Orchestrate use cases                   │
│   - Transform data for views                │
│   - Handle HTTP concerns                    │
├─────────────────────────────────────────────┤
│   Use Cases (Services)                       │  ← Application Layer
│   - Business workflows                      │
│   - Coordinate domain objects                │
│   - Platform-agnostic                       │
├─────────────────────────────────────────────┤
│   Domain (Entities, Value Objects)          │  ← Core
│   - Business rules                          │
│   - Pure TypeScript                         │
│   - No framework dependencies               │
└─────────────────────────────────────────────┘
```

**Dependency Rule**: Inner circles never depend on outer circles. Dependencies point inward.

## Why This Matters

### ✅ Good Architecture (This Library)

Controllers prepare data, React displays it:

```typescript
// ❌ NOT like this - business logic in component
function ProductPage() {
  const { id } = useParams();
  const product = await db.products.findOne(id);  // ❌ Data access in view
  const discount = product.price * 0.1;           // ❌ Business logic in view

  return <div>{product.name}: ${product.price - discount}</div>;
}
```

```typescript
// ✅ Clean Architecture - separation of concerns

// Domain Layer - Pure business logic
class Product {
  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly basePrice: number,
  ) {}

  calculatePrice(discountPolicy: DiscountPolicy): number {
    return discountPolicy.apply(this.basePrice);
  }
}

// Use Case Layer - Application workflow
@Injectable()
class GetProductUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly discountPolicy: DiscountPolicy,
  ) {}

  async execute(id: string): Promise<ProductDTO> {
    const product = await this.productRepo.findById(id);
    const finalPrice = product.calculatePrice(this.discountPolicy);

    return {
      id: product.id,
      name: product.name,
      price: finalPrice,
    };
  }
}

// Controller Layer - Orchestration
@Controller('products')
export class ProductController {
  constructor(private readonly getProduct: GetProductUseCase) {}

  @Get(':id')
  @Render(ProductDetail)
  async getProduct(@Param('id') id: string) {
    const product = await this.getProduct.execute(id);

    return {
      props: { product },
      head: {
        title: `${product.name} - Store`,
      },
    };
  }
}

// View Layer - Display only
interface ProductDetailProps {
  product: ProductDTO;
}

export default function ProductDetail({ data }: PageProps<ProductDetailProps>) {
  const { product } = data;

  return (
    <div>
      <h1>{product.name}</h1>
      <p>${product.price}</p>
    </div>
  );
}
```

**Benefits**:

- ✅ Business logic is testable without React
- ✅ Can swap React for another UI (Vue, Angular, CLI)
- ✅ Controllers are simple HTTP handlers
- ✅ Views are pure presentation
- ✅ Easy to understand and maintain

## Data Flow

Data flows **outward** from domain to views:

```
1. HTTP Request
   ↓
2. Controller receives request
   ↓
3. Controller calls Use Case (injected service)
   ↓
4. Use Case orchestrates Domain objects
   ↓
5. Domain executes business rules
   ↓
6. Results flow back through layers
   ↓
7. Controller prepares props for view
   ↓
8. React renders with props
```

### Example: E-Commerce Order

```typescript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Domain Layer - Business Rules
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class Order {
  private items: OrderItem[] = [];

  addItem(product: Product, quantity: number): void {
    // Business rule: Can't add more than 10 of same item
    if (quantity > 10) {
      throw new BusinessRuleViolation('Max 10 items per product');
    }

    this.items.push(new OrderItem(product, quantity));
  }

  calculateTotal(): Money {
    return this.items.reduce(
      (total, item) => total.add(item.subtotal()),
      Money.zero(),
    );
  }

  canCheckout(): boolean {
    // Business rule: Need at least one item
    return this.items.length > 0;
  }
}

class OrderItem {
  constructor(
    private readonly product: Product,
    private readonly quantity: number,
  ) {}

  subtotal(): Money {
    return this.product.price.multiply(this.quantity);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Use Case Layer - Application Workflow
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@Injectable()
class CreateOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly productRepo: ProductRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(userId: string, items: OrderItemDTO[]): Promise<OrderDTO> {
    const order = new Order(userId);

    // Fetch products and add to order
    for (const item of items) {
      const product = await this.productRepo.findById(item.productId);
      order.addItem(product, item.quantity);
    }

    // Validate business rules
    if (!order.canCheckout()) {
      throw new BusinessRuleViolation('Cannot checkout empty order');
    }

    // Save and send confirmation
    await this.orderRepo.save(order);
    await this.emailService.sendOrderConfirmation(order);

    return this.toDTO(order);
  }

  private toDTO(order: Order): OrderDTO {
    return {
      id: order.id,
      total: order.calculateTotal().amount,
      items: order.items.map(item => ({
        productName: item.product.name,
        quantity: item.quantity,
        subtotal: item.subtotal().amount,
      })),
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Controller Layer - HTTP Interface
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@Controller('orders')
export class OrderController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly getOrder: GetOrderUseCase,
  ) {}

  @Get(':id')
  @Render(OrderConfirmation)
  async getOrder(@Param('id') id: string) {
    const order = await this.getOrder.execute(id);

    return {
      props: { order },
      head: {
        title: `Order #${order.id} Confirmation`,
        description: `Order total: $${order.total}`,
      },
    };
  }

  @Post()
  async createOrder(@Body() dto: CreateOrderDTO) {
    return this.createOrder.execute(dto.userId, dto.items);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// View Layer - Presentation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface OrderConfirmationProps {
  order: OrderDTO;
}

export default function OrderConfirmation({ data }: PageProps<OrderConfirmationProps>) {
  const { order } = data;

  return (
    <div>
      <h1>Order Confirmation</h1>
      <p>Order #{order.id}</p>

      <ul>
        {order.items.map((item) => (
          <li key={item.productId}>
            {item.productName} × {item.quantity} = ${item.subtotal}
          </li>
        ))}
      </ul>

      <p>Total: ${order.total}</p>
    </div>
  );
}
```

**Notice**:

- Domain layer has **zero** dependencies on NestJS or React
- Use cases are pure TypeScript classes
- Controller is a thin orchestration layer
- React component is pure presentation

## Key Principles

### 1. Controllers Orchestrate, Don't Implement

Controllers should be thin. They call use cases, they don't contain business logic.

```typescript
// ❌ Bad - Business logic in controller
@Controller('products')
export class ProductController {
  @Get(':id')
  @Render(ProductDetail)
  async getProduct(@Param('id') id: string) {
    const product = await this.db.products.findOne(id);

    // ❌ Business logic in controller
    const discount = product.category === 'electronics' ? 0.1 : 0.05;
    const finalPrice = product.price * (1 - discount);

    return { props: { product, finalPrice } };
  }
}

// ✅ Good - Controller delegates to use case
@Controller('products')
export class ProductController {
  constructor(private readonly getProduct: GetProductUseCase) {}

  @Get(':id')
  @Render(ProductDetail)
  async getProduct(@Param('id') id: string) {
    const product = await this.getProduct.execute(id);
    return { props: { product } };
  }
}
```

### 2. React Components Receive Props, Period

React components should **never**:

- Access databases directly
- Call external APIs (except for client-side interactions)
- Contain business logic
- Instantiate domain objects

They **should only**:

- Receive props
- Display data
- Handle user events (submit forms, click buttons)
- Manage UI state (open/closed, selected tab)

```typescript
// ❌ Bad - Business logic in component
export default function ShoppingCart({ data }: PageProps<CartProps>) {
  const { items } = data;

  // ❌ Discount calculation in view
  const total = items.reduce((sum, item) => {
    const discount = item.quantity > 5 ? 0.1 : 0;
    return sum + (item.price * item.quantity * (1 - discount));
  }, 0);

  return <div>Total: ${total}</div>;
}

// ✅ Good - Calculation already done by use case
export default function ShoppingCart({ data }: PageProps<CartProps>) {
  const { items, total, totalSavings } = data;

  return (
    <div>
      <ul>
        {items.map(item => (
          <li key={item.id}>
            {item.name} × {item.quantity} = ${item.subtotal}
          </li>
        ))}
      </ul>
      <p>Savings: ${totalSavings}</p>
      <p>Total: ${total}</p>
    </div>
  );
}
```

### 3. Dependencies Point Inward

Outer layers depend on inner layers, never the reverse:

```typescript
// ✅ Good - View depends on DTO (interface adapter)
interface ProductDetailProps {
  product: ProductDTO; // ✅ DTO from application layer
}

// ✅ Good - Use case depends on domain
@Injectable()
class CreateProductUseCase {
  execute(dto: CreateProductDTO): Product {
    return new Product(dto.name, dto.price); // ✅ Domain object
  }
}

// ❌ Bad - Domain depends on outer layer
class Product {
  constructor(
    public name: string,
    public price: number,
    private httpClient: HttpClient, // ❌ Infrastructure in domain
  ) {}
}
```

### 4. Test Business Logic Independently

Your core business logic should be testable without spinning up React, HTTP servers, or databases:

```typescript
// ✅ Tests run in milliseconds, no framework needed
describe('Order', () => {
  it('should calculate total correctly', () => {
    const order = new Order('user-123');
    const product = new Product('Widget', Money.fromDollars(10));

    order.addItem(product, 3);

    expect(order.calculateTotal()).toEqual(Money.fromDollars(30));
  });

  it('should enforce business rule: max 10 items', () => {
    const order = new Order('user-123');
    const product = new Product('Widget', Money.fromDollars(10));

    expect(() => {
      order.addItem(product, 11);
    }).toThrow(BusinessRuleViolation);
  });
});
```

## Practical Guidelines

### Where Does Logic Go?

| Logic Type          | Layer       | Example                                     |
| ------------------- | ----------- | ------------------------------------------- |
| Business rules      | Domain      | "Premium users get 20% discount"            |
| Workflows           | Use Cases   | "Send email after order created"            |
| HTTP details        | Controllers | "Extract user ID from JWT"                  |
| Data transformation | Controllers | "Convert domain object to DTO"              |
| SEO/metadata        | Controllers | "Set page title based on product name"      |
| Display logic       | Views       | "Show 'Out of Stock' badge if quantity = 0" |
| User interactions   | Views       | "Toggle menu open/closed"                   |

### Common Patterns

#### Pattern 1: Simple Data Retrieval

```typescript
// Use Case
@Injectable()
class GetUserProfileUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(userId: string): Promise<UserProfileDTO> {
    const user = await this.userRepo.findById(userId);
    return {
      name: user.fullName,
      email: user.email,
      memberSince: user.createdAt,
    };
  }
}

// Controller
@Get('profile')
@Render(UserProfile)
async getProfile(@User() user: CurrentUser) {
  const profile = await this.getProfile.execute(user.id);
  return { props: { profile } };
}

// View
export default function UserProfile({ data }: PageProps<{ profile: UserProfileDTO }>) {
  return (
    <div>
      <h1>{data.profile.name}</h1>
      <p>{data.profile.email}</p>
      <p>Member since {new Date(data.profile.memberSince).toLocaleDateString()}</p>
    </div>
  );
}
```

#### Pattern 2: Complex Business Logic

```typescript
// Domain
class Subscription {
  renew(paymentMethod: PaymentMethod): SubscriptionRenewal {
    // Complex business rules
    if (this.isExpired() && this.gracePeriodEnded()) {
      throw new SubscriptionExpired();
    }

    const amount = this.calculateRenewalAmount();
    return new SubscriptionRenewal(this, paymentMethod, amount);
  }

  private calculateRenewalAmount(): Money {
    // Business logic for prorated amounts, discounts, etc.
  }
}

// Use Case
@Injectable()
class RenewSubscriptionUseCase {
  constructor(
    private readonly subRepo: SubscriptionRepository,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async execute(userId: string): Promise<RenewalResultDTO> {
    const subscription = await this.subRepo.findByUserId(userId);
    const paymentMethod = await this.getDefaultPaymentMethod(userId);

    const renewal = subscription.renew(paymentMethod);
    const payment = await this.paymentGateway.charge(renewal);

    await this.subRepo.save(subscription);

    return {
      success: true,
      amount: renewal.amount.toDollars(),
      nextBillingDate: subscription.nextBillingDate,
    };
  }
}

// Controller
@Post('subscription/renew')
@Render(RenewalConfirmation)
async renewSubscription(@User() user: CurrentUser) {
  const result = await this.renewSubscription.execute(user.id);

  return {
    props: { result },
    head: { title: 'Subscription Renewed' },
  };
}

// View
export default function RenewalConfirmation({ data }: PageProps<{ result: RenewalResultDTO }>) {
  return (
    <div>
      <h1>Subscription Renewed!</h1>
      <p>Charged: ${data.result.amount}</p>
      <p>Next billing: {new Date(data.result.nextBillingDate).toLocaleDateString()}</p>
    </div>
  );
}
```

#### Pattern 3: Composition of Multiple Use Cases

```typescript
// Controller composes multiple use cases
@Get('dashboard')
@Render(Dashboard)
async getDashboard(@User() user: CurrentUser) {
  const [profile, orders, recommendations] = await Promise.all([
    this.getProfile.execute(user.id),
    this.getRecentOrders.execute(user.id, { limit: 5 }),
    this.getRecommendations.execute(user.id),
  ]);

  return {
    props: { profile, orders, recommendations },
    layoutProps: { user: profile.name },
  };
}
```

## Benefits of This Approach

### 1. Framework Independence

Your business logic doesn't know about React or NestJS:

```typescript
// This code works anywhere: CLI, API, Web, Mobile
const order = new Order('user-123');
order.addItem(product, 2);
const total = order.calculateTotal();
```

You could:

- Build a CLI tool using the same use cases
- Create a mobile app with React Native
- Build a GraphQL API
- Run batch jobs
- All reusing the same business logic

### 2. Testability

Test pyramid is healthy:

```
        ┌─────┐
        │ E2E │  ← Few, slow, test user journeys
        └─────┘
      ┌─────────┐
      │ Integration │  ← Test use cases with real DB
      └─────────┘
    ┌─────────────┐
    │  Unit Tests  │  ← Many, fast, test business rules
    └─────────────┘
```

Most tests are unit tests of domain logic (fast, no dependencies).

### 3. Maintainability

Clear separation makes changes predictable:

- Need to change business rules? → Edit Domain
- Need to add a workflow? → Add Use Case
- Need to change HTML? → Edit View
- Need different data for view? → Modify Controller

No cascading changes across layers.

### 4. Team Scalability

Teams can work independently:

- **Backend team**: Focus on Domain + Use Cases
- **Frontend team**: Focus on React components
- **Integration**: Well-defined contract (DTOs)

Interface (DTOs) is the contract between teams.

## Common Pitfalls

### Pitfall 1: Fat Components

```typescript
// ❌ Component doing too much
export default function ProductPage({ data }: PageProps) {
  const [related, setRelated] = useState([]);

  useEffect(() => {
    // ❌ Fetching data in component
    fetch(`/api/products/${data.product.id}/related`)
      .then(res => res.json())
      .then(setRelated);
  }, []);

  // ❌ Business logic in component
  const discount = data.product.category === 'sale' ? 0.2 : 0;
  const finalPrice = data.product.price * (1 - discount);

  return <div>...</div>;
}

// ✅ Controller provides everything
@Get(':id')
@Render(ProductDetail)
async getProduct(@Param('id') id: string) {
  const product = await this.getProduct.execute(id);
  const related = await this.getRelatedProducts.execute(id);

  return {
    props: {
      product,  // Already has finalPrice calculated
      related,
    },
  };
}
```

### Pitfall 2: Anemic Domain Model

```typescript
// ❌ Anemic - domain object is just data
class Order {
  items: OrderItem[];
  total: number;
}

// Business logic lives in service (bad)
class OrderService {
  calculateTotal(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.subtotal, 0);
  }
}

// ✅ Rich domain model
class Order {
  private items: OrderItem[] = [];

  addItem(item: OrderItem): void {
    // Validation
    this.items.push(item);
  }

  calculateTotal(): Money {
    // Business logic lives with the data
    return this.items.reduce(
      (sum, item) => sum.add(item.subtotal()),
      Money.zero(),
    );
  }
}
```

### Pitfall 3: Controllers Doing Too Much

```typescript
// ❌ Controller contains business logic
@Post('checkout')
async checkout(@Body() dto: CheckoutDTO) {
  const user = await this.userRepo.findById(dto.userId);
  const cart = await this.cartRepo.findByUserId(dto.userId);

  // ❌ Business logic in controller
  let total = 0;
  for (const item of cart.items) {
    const discount = user.isPremium ? 0.1 : 0;
    total += item.price * item.quantity * (1 - discount);
  }

  // ... more business logic ...
}

// ✅ Controller delegates to use case
@Post('checkout')
async checkout(@Body() dto: CheckoutDTO) {
  return this.checkoutUseCase.execute(dto);
}
```

## Next Steps

- [Core Concepts](/guide/core-concepts) - Understand the SSR architecture
- [API Reference](/reference/api) - Complete API documentation
- [Examples](/examples) - Real-world implementations
- [Testing Guide](/guide/testing) - Test your clean architecture
