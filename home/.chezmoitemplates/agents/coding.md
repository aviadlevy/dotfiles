## Code

Write SOLID, object-oriented, secure, readable code. Beyond what those words already carry:

- **Layers:** controllers handle I/O, services hold business logic, repositories own data access.
- **Dependencies** are injected; put an interface in front of one once it has a second implementation.
- **Reuse:** extract shared logic on its third occurrence.
- **Errors** are typed and propagate with a meaningful message; every exception is handled or re-raised.
- **Immutable by default:** pure functions and immutable data; mutate only inside a well-defined boundary.
- **Minimal surface:** the smallest public API; internals stay private.
- **Security:** validate and sanitize input at system boundaries. Never introduce an OWASP Top-10
  vulnerability, and never log, expose, or hardcode secrets, tokens, or PII.
- **Tests:** testable by design (small units, injected dependencies, deterministic); each
  non-trivial logic path leaves one focused check.
