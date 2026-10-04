# Changelog

## v0.4.0-rc.1

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.31...v0.4.0-rc.1)

### 🚀 Enhancements

- **render:** Support NestJS 12 alongside NestJS 11 ([4a8a8c0](https://github.com/georgialexandrov/nestjs-ssr/commit/4a8a8c0))
- **hydration:** Load views per route in new projects ([e51c41b](https://github.com/georgialexandrov/nestjs-ssr/commit/e51c41b))
- **cli:** Update views without restarting Nest in development ([25d2791](https://github.com/georgialexandrov/nestjs-ssr/commit/25d2791))
- **render:** Show a useful error page when a page throws in development ([f9fd7ad](https://github.com/georgialexandrov/nestjs-ssr/commit/f9fd7ad))
- **cli:** Give new projects a starter layout and welcome page ([a068c29](https://github.com/georgialexandrov/nestjs-ssr/commit/a068c29))
- **render:** Add Nest 12 platform tooling (dev HMR, route code-splitting, prefetch) ([0514d57](https://github.com/georgialexandrov/nestjs-ssr/commit/0514d57))

### 🔥 Performance

- **render:** Detach and validate the public payload in one pass ([9142698](https://github.com/georgialexandrov/nestjs-ssr/commit/9142698))
- **render:** Import the production server bundle once ([82242d2](https://github.com/georgialexandrov/nestjs-ssr/commit/82242d2))
- **render:** Serialize plain hydration state in one pass ([b4b60ef](https://github.com/georgialexandrov/nestjs-ssr/commit/b4b60ef))
- **render:** Cut per-request server work (group 2) ([ea25328](https://github.com/georgialexandrov/nestjs-ssr/commit/ea25328))

### 🩹 Fixes

- **cli:** Generate scripts for the project's package manager ([20eef1b](https://github.com/georgialexandrov/nestjs-ssr/commit/20eef1b))
- **render:** Read allowed cookies without a cookie parser ([022c447](https://github.com/georgialexandrov/nestjs-ssr/commit/022c447))
- **render:** Harden the render pipeline (group 1) ([6b69593](https://github.com/georgialexandrov/nestjs-ssr/commit/6b69593))
- **hooks:** Restore the useRequest name in its outside-provider error ([4333474](https://github.com/georgialexandrov/nestjs-ssr/commit/4333474))
- **security:** Parse the raw Cookie header into a prototype-less jar ([d969f55](https://github.com/georgialexandrov/nestjs-ssr/commit/d969f55))
- **vite:** Match view files without a backtracking regex ([a5d1062](https://github.com/georgialexandrov/nestjs-ssr/commit/a5d1062))
- **security:** Keep raw-header cookies in a Map ([d055e22](https://github.com/georgialexandrov/nestjs-ssr/commit/d055e22))
- **security:** Reject segment responses that redirect to another origin ([54f9b0a](https://github.com/georgialexandrov/nestjs-ssr/commit/54f9b0a))
- **security:** Check head and layout props against payload limits ([69cf8c5](https://github.com/georgialexandrov/nestjs-ssr/commit/69cf8c5))

### 💅 Refactors

- **api:** Deprecate jsonApi, static layout props, and JsonApiResponse ([bb66c86](https://github.com/georgialexandrov/nestjs-ssr/commit/bb66c86))
- **render:** Drop the head serialization fast path ([d1c3c9b](https://github.com/georgialexandrov/nestjs-ssr/commit/d1c3c9b))

### 📖 Documentation

- **docs:** Plan the Nest 12 platform release as an openspec change ([0cb7d16](https://github.com/georgialexandrov/nestjs-ssr/commit/0cb7d16))
- **docs:** Hold the Nest 12 plan to full backwards compatibility ([5c7e7dd](https://github.com/georgialexandrov/nestjs-ssr/commit/5c7e7dd))
- **docs:** Record measured performance and progress in the Nest 12 plan ([71474a5](https://github.com/georgialexandrov/nestjs-ssr/commit/71474a5))
- **docs:** Document Nest 12 support, the 0.4 opt-ins and measured performance ([b1bc562](https://github.com/georgialexandrov/nestjs-ssr/commit/b1bc562))
- **docs:** Plan and document the Nest 12 platform release ([03f7cd8](https://github.com/georgialexandrov/nestjs-ssr/commit/03f7cd8))
- **perf:** Document ETag, static-index, and caching numbers ([cdb845e](https://github.com/georgialexandrov/nestjs-ssr/commit/cdb845e))
- **openspec:** Propose dev-loop restart reliability ([f2bd659](https://github.com/georgialexandrov/nestjs-ssr/commit/f2bd659))
- Update measured performance table and tick render-pipeline-hardening tasks ([e42f6a3](https://github.com/georgialexandrov/nestjs-ssr/commit/e42f6a3))
- **docs:** Cover response changes, static index, and deprecations in the migration guide ([b9bdd3c](https://github.com/georgialexandrov/nestjs-ssr/commit/b9bdd3c))
- **docs:** Tick render-pipeline-hardening release checks 4.1 and 4.2 ([b7cafe2](https://github.com/georgialexandrov/nestjs-ssr/commit/b7cafe2))
- **docs:** Note metadata validation and redirect refusal for 0.4.0-rc.1 ([3976c16](https://github.com/georgialexandrov/nestjs-ssr/commit/3976c16))

### 📦 Build

- **deps:** Build the package with tsdown on TypeScript 7 ([2a5b75f](https://github.com/georgialexandrov/nestjs-ssr/commit/2a5b75f))
- **ci:** Lint with oxlint so the repo can run on TypeScript 7 ([2ffce87](https://github.com/georgialexandrov/nestjs-ssr/commit/2ffce87))
- **examples:** Run the example on Nest 12 ([5b1663a](https://github.com/georgialexandrov/nestjs-ssr/commit/5b1663a))
- **examples:** Run the example's Nest dev process through nestjs-ssr dev ([ac95cb9](https://github.com/georgialexandrov/nestjs-ssr/commit/ac95cb9))
- **deps:** Give dependency-cruiser the TypeScript API it needs ([dd393f1](https://github.com/georgialexandrov/nestjs-ssr/commit/dd393f1))
- **ci:** Add browser-suite and pnpm 12 CI workflows for Nest 12 platform work ([c09c475](https://github.com/georgialexandrov/nestjs-ssr/commit/c09c475))
- **examples:** Run the example on Vitest through nestjs-ssr dev tooling ([5a26857](https://github.com/georgialexandrov/nestjs-ssr/commit/5a26857))
- **ci:** Build the package before knip in the lint job ([2b72af9](https://github.com/georgialexandrov/nestjs-ssr/commit/2b72af9))
- **deps:** Pin patched fastify and fast-uri, ignore the unfixed braces advisory ([dcd4dd7](https://github.com/georgialexandrov/nestjs-ssr/commit/dcd4dd7))
- **ci:** Publish semver prereleases under the next dist-tag ([8674763](https://github.com/georgialexandrov/nestjs-ssr/commit/8674763))

### 🏡 Chore

- **ci:** Format sources that CI's prettier check rejected ([a840180](https://github.com/georgialexandrov/nestjs-ssr/commit/a840180))

### ✅ Tests

- **render:** Measure end-to-end SSR throughput against JSON ([72d06d7](https://github.com/georgialexandrov/nestjs-ssr/commit/72d06d7))
- **render:** Record toolchain timings after the TypeScript 7 move ([11ba242](https://github.com/georgialexandrov/nestjs-ssr/commit/11ba242))
- **ci:** Run the browser-suite fixtures under pnpm 12 ([6c35d0b](https://github.com/georgialexandrov/nestjs-ssr/commit/6c35d0b))
- **render:** Gate end-to-end SSR cost on server CPU per request ([a7cc95a](https://github.com/georgialexandrov/nestjs-ssr/commit/a7cc95a))
- **fastify:** Assert static assets win route priority over app routes ([643a943](https://github.com/georgialexandrov/nestjs-ssr/commit/643a943))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.31

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.30...v0.3.31)

### 🚀 Enhancements

- Rebuild the rendered-response path without changing any response ([ed13d58](https://github.com/georgialexandrov/nestjs-ssr/commit/ed13d58))

### 🩹 Fixes

- **render:** Harden response pipeline without API breaks ([53354f8](https://github.com/georgialexandrov/nestjs-ssr/commit/53354f8))

### 📖 Documentation

- **render:** Align the response-negotiation spec with the no-break contract ([593862b](https://github.com/georgialexandrov/nestjs-ssr/commit/593862b))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.30

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.29...v0.3.30)

### 🏡 Chore

- **ci)(deps:** Bump github/codeql-action/autobuild ([a603207](https://github.com/georgialexandrov/nestjs-ssr/commit/a603207))
- **ci)(deps:** Bump github/codeql-action/analyze from 4.37.9 to 4.38.0 ([b476532](https://github.com/georgialexandrov/nestjs-ssr/commit/b476532))
- **ci)(deps:** Bump actions/upload-artifact from 4.6.2 to 7.0.1 ([0adef8d](https://github.com/georgialexandrov/nestjs-ssr/commit/0adef8d))
- **deps-dev)(deps-dev:** Bump the dev-dependencies group with 5 updates ([fa3edee](https://github.com/georgialexandrov/nestjs-ssr/commit/fa3edee))
- **deps-dev)(deps-dev:** Bump @vitest/coverage-v8 from 4.1.11 to 5.0.0 ([5371cf1](https://github.com/georgialexandrov/nestjs-ssr/commit/5371cf1))
- **deps-dev)(deps-dev:** Bump @nestjs/cli from 11.0.24 to 12.0.0 ([f588009](https://github.com/georgialexandrov/nestjs-ssr/commit/f588009))
- **deps-dev)(deps-dev:** Bump @vitest/ui from 4.1.11 to 5.0.0 ([17cdeb5](https://github.com/georgialexandrov/nestjs-ssr/commit/17cdeb5))
- **deps)(deps:** Bump @nestjs/common from 11.1.28 to 12.0.1 ([7584417](https://github.com/georgialexandrov/nestjs-ssr/commit/7584417))
- **deps-dev:** Bump vitest to 5 to match @vitest/ui and coverage-v8 ([b4603a2](https://github.com/georgialexandrov/nestjs-ssr/commit/b4603a2))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.29

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.28...v0.3.29)

### 🩹 Fixes

- Type the render pipeline and close the filesystem races ([ab8403d](https://github.com/georgialexandrov/nestjs-ssr/commit/ab8403d))

### 🏡 Chore

- **ci:** Release v0.3.29 ([b267e38](https://github.com/georgialexandrov/nestjs-ssr/commit/b267e38))
- **ci:** Release v0.3.29" ([7ac01b4](https://github.com/georgialexandrov/nestjs-ssr/commit/7ac01b4))
- **ci)(deps:** Bump actions/deploy-pages from 5.0.0 to 5.0.1 ([#128](https://github.com/georgialexandrov/nestjs-ssr/pull/128))

### 🤖 CI

- Gate releases on the browser matrix and disable hooks in the release job ([99cc20d](https://github.com/georgialexandrov/nestjs-ssr/commit/99cc20d))
- Bump pinned actions and give npm publish its credential back ([8d15383](https://github.com/georgialexandrov/nestjs-ssr/commit/8d15383))
- Keep the publish step credential-free, as the policy requires ([291362c](https://github.com/georgialexandrov/nestjs-ssr/commit/291362c))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.28

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.27...v0.3.28)

### 🩹 Fixes

- **ci:** Restore npm auth token on the publish step ([2cc55c7](https://github.com/georgialexandrov/nestjs-ssr/commit/2cc55c7))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.27

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.26...v0.3.27)

### 🩹 Fixes

- **security:** ⚠️ Close three exposure paths in the dev proxy and navigation ([4bea5d6](https://github.com/georgialexandrov/nestjs-ssr/commit/4bea5d6))
- **security:** Harden SSR and enforce regression guardrails ([86d37a8](https://github.com/georgialexandrov/nestjs-ssr/commit/86d37a8))

#### ⚠️ Breaking Changes

- **security:** ⚠️ Close three exposure paths in the dev proxy and navigation ([4bea5d6](https://github.com/georgialexandrov/nestjs-ssr/commit/4bea5d6))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.26

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.25...v0.3.26)

### 🚀 Enhancements

- **render:** Add nest-cli.json SSR path resolution for monorepos ([7a2ac06](https://github.com/georgialexandrov/nestjs-ssr/commit/7a2ac06))

### 🩹 Fixes

- **render:** Proxy Vite's HMR WebSocket handshake ([cf54994](https://github.com/georgialexandrov/nestjs-ssr/commit/cf54994))
- **examples:** Pin Vite to a fixed port and set NODE_ENV in prod scripts ([f72b897](https://github.com/georgialexandrov/nestjs-ssr/commit/f72b897))
- **render:** Attach the caught error as cause on template read failures ([a5e4cd7](https://github.com/georgialexandrov/nestjs-ssr/commit/a5e4cd7))
- **deps:** Clear all 61 audit advisories ([5327fd5](https://github.com/georgialexandrov/nestjs-ssr/commit/5327fd5))
- **render:** Load the user vite config on the embedded SSR server ([84faa04](https://github.com/georgialexandrov/nestjs-ssr/commit/84faa04))
- **test:** Make browser fixtures build and run deterministically ([1006103](https://github.com/georgialexandrov/nestjs-ssr/commit/1006103))
- **render:** Silence Vite startup warnings in dev ([f3a1084](https://github.com/georgialexandrov/nestjs-ssr/commit/f3a1084))
- **examples:** Fail gracefully when the dev port is already taken ([4a7c9c9](https://github.com/georgialexandrov/nestjs-ssr/commit/4a7c9c9))
- **config:** Drop dead re-export barrels so knip passes ([ef70b9a](https://github.com/georgialexandrov/nestjs-ssr/commit/ef70b9a))

### 📖 Documentation

- Document the ws.clientPort requirement for HMR ([28b7b2c](https://github.com/georgialexandrov/nestjs-ssr/commit/28b7b2c))
- Align API reference with the shipped props and head API ([3cc93a2](https://github.com/georgialexandrov/nestjs-ssr/commit/3cc93a2))
- **security:** Add a real reporting channel to the security policy ([1adf63d](https://github.com/georgialexandrov/nestjs-ssr/commit/1adf63d))
- Add AGENTS.md mirroring CLAUDE.md ([23094ce](https://github.com/georgialexandrov/nestjs-ssr/commit/23094ce))
- State the Node 22.15 requirement ([fe964b7](https://github.com/georgialexandrov/nestjs-ssr/commit/fe964b7))

### 🏡 Chore

- **config:** Add knip and dependency-cruiser, drop unused deps and dead code ([f0374ec](https://github.com/georgialexandrov/nestjs-ssr/commit/f0374ec))

### 🎨 Styles

- **navigation:** Apply prettier formatting to getCurrentLayouts ([300324d](https://github.com/georgialexandrov/nestjs-ssr/commit/300324d))

### 🤖 CI

- Run the Playwright suites on every pull request ([e7095f1](https://github.com/georgialexandrov/nestjs-ssr/commit/e7095f1))
- Test on Node 26 and pin engines to the supported lines ([99a6301](https://github.com/georgialexandrov/nestjs-ssr/commit/99a6301))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>
- KhoaHTD <khoa.htd@amanotes.com>
- Georgi <georgi@georgis-MacBook-Air.local>

## v0.3.25

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.24...v0.3.25)

### 🩹 Fixes

- **ci:** Pin pnpm to node 20 compatible version ([f960d65](https://github.com/georgialexandrov/nestjs-ssr/commit/f960d65))

### 🏡 Chore

- Adopt pnpm 11.8.0 ([02a9668](https://github.com/georgialexandrov/nestjs-ssr/commit/02a9668))

### 🤖 CI

- Let pnpm/action-setup read version from packageManager ([ebaa434](https://github.com/georgialexandrov/nestjs-ssr/commit/ebaa434))

### ❤️ Contributors

- Georgi <georgi@georgis-MacBook-Air.local>

## v0.3.24

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.23...v0.3.24)

### 🩹 Fixes

- **security:** Harden segment requests, head tags, and env detection ([191a6ff](https://github.com/georgialexandrov/nestjs-ssr/commit/191a6ff))
- **render:** Make dev-server shutdown survive hot-reload races ([ebec8a9](https://github.com/georgialexandrov/nestjs-ssr/commit/ebec8a9))

### 💅 Refactors

- **render:** Unify renderer pipelines and fix stream script placement ([f50cf19](https://github.com/georgialexandrov/nestjs-ssr/commit/f50cf19))

### ✅ Tests

- Add CLI init, component-name, and stream renderer coverage ([44f94b8](https://github.com/georgialexandrov/nestjs-ssr/commit/44f94b8))

### ❤️ Contributors

- Georgi <georgi@georgis-MacBook-Air.local>
- Claude <noreply@anthropic.com>

## v0.3.23

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.22...v0.3.23)

### 🩹 Fixes

- **render:** Discover and resolve view components in submodule views dirs ([5392b8a](https://github.com/georgialexandrov/nestjs-ssr/commit/5392b8a))

### ❤️ Contributors

- Georgi <georgi@georgis-MacBook-Air.local>

## v0.3.22

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.21...v0.3.22)

### 🩹 Fixes

- **render:** Destroy upgraded sockets on shutdown to unblock HMR restart ([c2db432](https://github.com/georgialexandrov/nestjs-ssr/commit/c2db432))

### ❤️ Contributors

- Georgi <georgi@georgis-MacBook-Air.local>

## v0.3.21

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.20...v0.3.21)

### 🩹 Fixes

- **render:** Disable HMR WebSocket on SSR Vite middleware server ([acb8a65](https://github.com/georgialexandrov/nestjs-ssr/commit/acb8a65))
- **render:** Use hmr:{port:0} and close HTTP connections on hot reload ([1438f59](https://github.com/georgialexandrov/nestjs-ssr/commit/1438f59))

### ❤️ Contributors

- Georgi <georgi@georgis-MacBook-Air.local>

## v0.3.20

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.19...v0.3.20)

### 🩹 Fixes

- **examples:** Use function form of manualChunks for vite 8/rolldown ([6cda508](https://github.com/georgialexandrov/nestjs-ssr/commit/6cda508))

### 🏡 Chore

- **ci)(deps:** Bump actions/upload-pages-artifact from 4 to 5 ([#70](https://github.com/georgialexandrov/nestjs-ssr/pull/70))
- **deps)(deps:** Bump the nestjs group with 3 updates ([#71](https://github.com/georgialexandrov/nestjs-ssr/pull/71))
- **deps)(deps:** Bump the react group with 2 updates ([#72](https://github.com/georgialexandrov/nestjs-ssr/pull/72))
- **deps-dev)(deps-dev:** Bump vite in the vite group ([#73](https://github.com/georgialexandrov/nestjs-ssr/pull/73))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.19

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.18...v0.3.19)

### 🩹 Fixes

- **ci:** Pin pnpm version in release and docs workflows ([8099443](https://github.com/georgialexandrov/nestjs-ssr/commit/8099443))

### 🏡 Chore

- **ci)(deps:** Bump softprops/action-gh-release from 2 to 3 ([#66](https://github.com/georgialexandrov/nestjs-ssr/pull/66))
- **config:** Allowlist dependency build scripts for pnpm 10+ ([720a381](https://github.com/georgialexandrov/nestjs-ssr/commit/720a381))
- **config:** Move pnpm build-script allowlist to pnpm-workspace.yaml ([ab30c8e](https://github.com/georgialexandrov/nestjs-ssr/commit/ab30c8e))
- **ci:** Pin pnpm version via packageManager field ([edc0726](https://github.com/georgialexandrov/nestjs-ssr/commit/edc0726))
- **ci:** Pin pnpm to exact 10.15.0 via setup action ([ab7b557](https://github.com/georgialexandrov/nestjs-ssr/commit/ab7b557))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.18

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.17...v0.3.18)

### 🚀 Enhancements

- **cli:** Add SWC builder support for .tsx compilation ([1e6e59c](https://github.com/georgialexandrov/nestjs-ssr/commit/1e6e59c))

### 🏡 Chore

- **ci:** Bump actions/configure-pages from 5 to 6 ([9fe2cdd](https://github.com/georgialexandrov/nestjs-ssr/commit/9fe2cdd))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.17

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.16...v0.3.17)

### 🩹 Fixes

- **deps:** Bump vitest 4.1.2, happy-dom 20.8.9 to resolve CVEs and add minimum-release-age ([2bf2625](https://github.com/georgialexandrov/nestjs-ssr/commit/2bf2625))

### 🏡 Chore

- **ci)(deps:** Bump actions/deploy-pages from 4 to 5 ([#63](https://github.com/georgialexandrov/nestjs-ssr/pull/63))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.16

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.15...v0.3.16)

## v0.3.15

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.14...v0.3.15)

### 🩹 Fixes

- **hydration:** Convert kebab-case filenames to PascalCase for production builds ([b956ea2](https://github.com/georgialexandrov/nestjs-ssr/commit/b956ea2))

### 📖 Documentation

- **docs:** Add fix-kebab-case-hydration change plan ([ab900a9](https://github.com/georgialexandrov/nestjs-ssr/commit/ab900a9))

### ✅ Tests

- **render:** Add unit tests for hooks, ViteInitializer, and StringRenderer ([8de8c9d](https://github.com/georgialexandrov/nestjs-ssr/commit/8de8c9d))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.14

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.13...v0.3.14)

### 🚀 Enhancements

- **render:** Add JSON API mode for content negotiation ([738c626](https://github.com/georgialexandrov/nestjs-ssr/commit/738c626))

### 📖 Documentation

- **docs:** Add json-api-mode change plan ([baa38df](https://github.com/georgialexandrov/nestjs-ssr/commit/baa38df))
- **docs:** Archive json-api-mode change, sync specs ([4939318](https://github.com/georgialexandrov/nestjs-ssr/commit/4939318))

### 🏡 Chore

- **config:** Ignore AI tooling config directories ([7cbcd3a](https://github.com/georgialexandrov/nestjs-ssr/commit/7cbcd3a))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.13

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.12...v0.3.13)

### 🏡 Chore

- Add .internal/ to gitignore, fix lint error in auth guard ([7578200](https://github.com/georgialexandrov/nestjs-ssr/commit/7578200))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.12

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.11...v0.3.12)

## v0.3.11

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.10...v0.3.11)

### 🏡 Chore

- **deps)(deps:** Bump the nestjs group with 3 updates ([#36](https://github.com/georgialexandrov/nestjs-ssr/pull/36))

## v0.3.10

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.9...v0.3.10)

### 🏡 Chore

- **deps)(deps:** Bump devalue from 5.6.2 to 5.6.3 ([#34](https://github.com/georgialexandrov/nestjs-ssr/pull/34))

## v0.3.9

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.8...v0.3.9)

### 🏡 Chore

- **deps)(deps:** Bump citty from 0.2.0 to 0.2.1 ([#32](https://github.com/georgialexandrov/nestjs-ssr/pull/32))
- **deps-dev)(deps-dev:** Bump globals from 16.5.0 to 17.3.0 ([#31](https://github.com/georgialexandrov/nestjs-ssr/pull/31))
- **deps-dev)(deps-dev:** Bump the dev-dependencies group across 1 directory with 7 updates ([#33](https://github.com/georgialexandrov/nestjs-ssr/pull/33))

## v0.3.8

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.7...v0.3.8)

### 🚀 Enhancements

- **examples:** Replace users app with recipe site, remove minimal-fastify ([7dbece0](https://github.com/georgialexandrov/nestjs-ssr/commit/7dbece0))

### 🩹 Fixes

- **hydration:** Resolve layout hydration on hard refresh ([3e5a3bf](https://github.com/georgialexandrov/nestjs-ssr/commit/3e5a3bf))

### 📖 Documentation

- Overhaul homepage, README, and llms.txt ([e87bfa8](https://github.com/georgialexandrov/nestjs-ssr/commit/e87bfa8))

### ✅ Tests

- **render:** Add E2E acceptance tests for Express and Fastify adapters ([96fa8d4](https://github.com/georgialexandrov/nestjs-ssr/commit/96fa8d4))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.7

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.6...v0.3.7)

### 🚀 Enhancements

- **examples:** Add minimal Fastify example with streaming SSR ([73bfcb0](https://github.com/georgialexandrov/nestjs-ssr/commit/73bfcb0))

### 🩹 Fixes

- **render:** Handle missing request.path for Fastify adapter ([16c02cb](https://github.com/georgialexandrov/nestjs-ssr/commit/16c02cb))

### 🏡 Chore

- **ci:** Bump actions/checkout to v6 and upload-pages-artifact to v4 ([7d33fc1](https://github.com/georgialexandrov/nestjs-ssr/commit/7d33fc1))

### ✅ Tests

- **render:** Add Fastify adapter compatibility tests for interceptor ([78ccf50](https://github.com/georgialexandrov/nestjs-ssr/commit/78ccf50))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.6

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.5...v0.3.6)

### 🚀 Enhancements

- **render:** Add Fastify adapter support for streaming SSR ([741a7f3](https://github.com/georgialexandrov/nestjs-ssr/commit/741a7f3))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.5

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.4...v0.3.5)

### 🚀 Enhancements

- **render:** Add context factory for custom context properties ([513ff6a](https://github.com/georgialexandrov/nestjs-ssr/commit/513ff6a))

### 🩹 Fixes

- **layout:** Fix nested layout composition and hydration ([d283a48](https://github.com/georgialexandrov/nestjs-ssr/commit/d283a48))

### 📖 Documentation

- Reorganize documentation structure ([94de5a7](https://github.com/georgialexandrov/nestjs-ssr/commit/94de5a7))
- Add context factory to llms.txt ([87bf31f](https://github.com/georgialexandrov/nestjs-ssr/commit/87bf31f))
- Fix broken links and update homepage ([0ae1df7](https://github.com/georgialexandrov/nestjs-ssr/commit/0ae1df7))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.4

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.3...v0.3.4)

### 🩹 Fixes

- **hydration:** Align client-side layout composition with server rendering ([71d1bc4](https://github.com/georgialexandrov/nestjs-ssr/commit/71d1bc4))
- **cli:** Resolve TypeScript and ESLint warnings ([0912418](https://github.com/georgialexandrov/nestjs-ssr/commit/0912418))
- **config:** Use project TypeScript for api-extractor ([f1a2007](https://github.com/georgialexandrov/nestjs-ssr/commit/f1a2007))
- **config:** Regenerate API report with bundled TypeScript format ([48b2c16](https://github.com/georgialexandrov/nestjs-ssr/commit/48b2c16))

### 📖 Documentation

- Add Tailwind CSS integration guide ([c209bf3](https://github.com/georgialexandrov/nestjs-ssr/commit/c209bf3))

### 🏡 Chore

- **ci:** Add coverage check to pre-commit and adjust thresholds ([cbf04b6](https://github.com/georgialexandrov/nestjs-ssr/commit/cbf04b6))
- **ci:** Add full CI checks to pre-commit hook ([5fb84cb](https://github.com/georgialexandrov/nestjs-ssr/commit/5fb84cb))
- **ci:** Remove API surface check from CI and pre-commit ([4e785cd](https://github.com/georgialexandrov/nestjs-ssr/commit/4e785cd))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.3

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.2...v0.3.3)

### 🩹 Fixes

- **render:** Load root layout from entry-server bundle in production ([23f1672](https://github.com/georgialexandrov/nestjs-ssr/commit/23f1672))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.2

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.1...v0.3.2)

## v0.3.1

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.0...v0.3.1)

### 🩹 Fixes

- **render:** Fix duplicate layout and segment rendering ([e7bda38](https://github.com/georgialexandrov/nestjs-ssr/commit/e7bda38))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.0

### 🚀 Enhancements

- **streaming:** Add inline error overlay for streaming SSR errors ([f50c20a](https://github.com/georgialexandrov/nestjs-ssr/commit/f50c20a))
- **render:** Add segment rendering and client-side navigation ([38f7ff4](https://github.com/georgialexandrov/nestjs-ssr/commit/38f7ff4))
- **examples:** Add client-side navigation demo with active link highlighting ([195f932](https://github.com/georgialexandrov/nestjs-ssr/commit/195f932))

### 🩹 Fixes

- **hydration:** Wrap SSR output with PageContextProvider for hooks support ([b9bd070](https://github.com/georgialexandrov/nestjs-ssr/commit/b9bd070))

### 💅 Refactors

- **vite:** ⚠️ Remove embedded mode, keep only HMR proxy mode ([82a6581](https://github.com/georgialexandrov/nestjs-ssr/commit/82a6581))
- **render:** Extract StringRenderer and StreamRenderer classes ([8a1039d](https://github.com/georgialexandrov/nestjs-ssr/commit/8a1039d))

#### ⚠️ Breaking Changes

- **vite:** ⚠️ Remove embedded mode, keep only HMR proxy mode ([82a6581](https://github.com/georgialexandrov/nestjs-ssr/commit/82a6581))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.2.5 (Initial Public Release)

React SSR for NestJS with full TypeScript type safety.

### Core Features

- **Server-Side Rendering** - String and streaming modes with React 19
- **Client Hydration** - Seamless hydration with props serialization
- **Vite Integration** - Embedded or proxy mode with HMR support
- **Layout System** - Root layout auto-discovery and nested layouts
- **Request Context** - Hooks for params, query, headers, cookies
- **Security** - allowedHeaders/allowedCookies whitelist, XSS protection
- **CLI Tool** - `npx @nestjs-ssr/react init` scaffolds your project

### Architecture

Controllers return data, React components render views:

```typescript
@Controller()
export class AppController {
  @Get()
  @Render(HomePage)
  index() {
    return { title: 'Welcome' };
  }
}
```

NestJS owns routing, guards, interceptors. React is just the view layer.

### Requirements

- NestJS 11+
- React 19+
- Vite 6+

### Contributors

- Georgi Alexandrov ([@georgialexandrov](https://github.com/georgialexandrov))
