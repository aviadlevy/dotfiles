## Coding Principles

We write SOLID, OOP, clean, and secure code. Every piece of code must adhere to:

- **Single Responsibility:** Each class/function does one thing well. Separate concerns across layers — controllers handle I/O, services handle business logic, repositories handle data access.
- **Open/Closed:** Extend behavior through new classes, modules, or composition — not by modifying existing, tested code.
- **Liskov Substitution:** Subclasses must be fully substitutable for their base types without breaking behavior or violating contracts.
- **Interface Segregation:** Expose only what consumers need. Use narrow interfaces or type-picked subsets for dependencies, mocks, and public APIs.
- **Dependency Inversion:** Depend on abstractions, not concretions. Inject dependencies rather than instantiating them directly.
- **Security:** Never introduce OWASP Top-10 vulnerabilities. Validate and sanitize all inputs at system boundaries. Never log, expose, or hardcode sensitive data (secrets, tokens, PII).
- **DRY (Don't Repeat Yourself):** Extract shared logic into reusable utilities, base classes, or helpers. If you write something twice, abstract it.
- **Fail Explicitly:** Use clear, typed error handling. Avoid swallowing exceptions silently. Propagate meaningful error messages and codes.
- **Readability Over Cleverness:** Write code that reads like well-structured prose. Favor descriptive names, small functions, and obvious flow over compact or "clever" solutions.
- **Immutability by Default:** Prefer immutable data structures and pure functions. Mutate state only when explicitly necessary and in well-defined boundaries.
- **Minimal Surface Area:** Expose the smallest possible public API. Keep internals private. The less surface area, the less that can break or be misused.
- **Test-Driven Confidence:** Write code that is testable by design — small units, injected dependencies, deterministic behavior. Tests are not optional; they are documentation and a safety net.
