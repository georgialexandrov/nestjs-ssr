## MODIFIED Requirements

### Requirement: One public payload boundary

The system SHALL project every client-visible HTML hydration state, JSON body, and segment payload through a common public-payload boundary before serialization.

The boundary SHALL produce a snapshot of the projected graph that is detached from every object the application holds. The detachment SHALL happen in a single validating pass. Mutations made to the application's objects after projection SHALL NOT reach any serialized channel.

The snapshot SHALL be deeply immutable in every environment, exactly as before this change: a mutation attempt throws in strict-mode code, and Map/Set mutators throw.

#### Scenario: Private domain data is omitted by a projector

- **WHEN** a representation projector maps a domain value to a public DTO
- **THEN** HTML hydration, JSON, and segment serialization SHALL receive only the projected public graph
- **AND** SHALL NOT retain a reference to the original domain value

#### Scenario: Representation has a distinct DTO

- **WHEN** the HTML and JSON representations define different public projectors
- **THEN** each channel SHALL serialize only its selected projected DTO

#### Scenario: Controller mutates its data after returning

- **WHEN** a controller mutates the object it returned after the boundary has projected it, for example from a timer while a stream render is in progress
- **THEN** the serialized hydration state SHALL equal the graph as it was at projection time

#### Scenario: Component mutates props

- **WHEN** a page component assigns to a property of its props during a render
- **THEN** the assignment SHALL throw, as it did before this change

#### Scenario: Snapshot preserves supported value semantics

- **WHEN** the projected graph contains a `Date`, `Map`, `Set`, `RegExp`, a class instance, a shared reference or a cycle permitted by the serializer target
- **THEN** the snapshot SHALL preserve the type, prototype, sharing and cycle structure the serializer supported before this change
