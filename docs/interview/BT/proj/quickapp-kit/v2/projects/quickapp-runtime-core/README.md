# quickapp-runtime-core

Shared C++ runtime core.

Scope:

- RPK package loading contract
- Manifest model
- Runtime host
- JS engine adapter boundary
- VNode and Shadow Tree
- Diff and reconcile
- Style resolving
- Layout pipeline
- Render mutation pipeline
- Event dispatch
- Capability module bridge

Principle:

```text
Core owns semantics.
Backends own widgets.
```
