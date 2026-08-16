const id = (name) => `https://quickapp-kit.dev/v1/${name}.schema.json`;
const sha256 = "a".repeat(64);
const ref = (ownerInstanceId, templateNodeId) => ({ ownerInstanceId, templateNodeId });
const runtimeError = (code, extra = {}) => ({
  code,
  message: code.toLowerCase(),
  retryable: false,
  ...extra
});
const artifact = (path, mediaType = "application/json") => ({
  path,
  mediaType,
  byteLength: 1,
  sha256
});

export const manifest = {
  package: "com.example.case",
  name: "case",
  versionName: "1.0.0",
  versionCode: 1,
  minPlatformVersion: 1000,
  features: [{ name: "system.router" }, { name: "system.prompt" }],
  router: {
    entry: "pages/Demo",
    pages: {
      "pages/Demo": { component: "index" }
    },
    widgets: {}
  }
};

export const runtimeMetadata = {
  schemaVersion: 1,
  packageFormat: "quickapp-kit-rpk-v1",
  runtimeAbi: "quickapp-kit-runtime-v1",
  irVersion: 1,
  jsModuleAbi: "quickapp-kit-app-module-v1",
  packageId: "com.example.case",
  toolkit: { name: "quickapp-toolkit", version: "1.0.0" },
  buildMode: "debug",
  entryRoute: "/pages/Demo",
  app: {
    moduleId: "@quickapp-kit/app",
    bundle: artifact("app.js", "application/javascript")
  },
  sharedModules: [],
  pages: [
    {
      route: "/pages/Demo",
      manifestRoute: "pages/Demo",
      component: "index",
      moduleId: "@quickapp-kit/page/pages/Demo",
      dependencies: [],
      templateId: "pages/Demo:index",
      bundle: artifact("pages/Demo/index.js", "application/javascript"),
      pageIr: artifact("quickapp-kit/pages/Demo/index.ir.json")
    }
  ],
  resources: [artifact("assets/logo.png", "image/png")]
};

export const pageIr = {
  schemaVersion: 1,
  templateId: "pages/Demo:index",
  rootTemplateNodeId: 1,
  nodes: [
    {
      templateNodeId: 1,
      host: { type: "View", props: {}, style: {} },
      children: [
        { kind: "node", templateNodeId: 2 },
        { kind: "node", templateNodeId: 3 },
        { kind: "block", templateBlockId: 1 }
      ]
    },
    {
      templateNodeId: 2,
      host: { type: "Text", props: { text: "" }, style: {} },
      children: []
    },
    {
      templateNodeId: 3,
      host: { type: "Button", props: { text: "Go", enabled: true }, style: {} },
      children: []
    },
    {
      templateNodeId: 4,
      host: { type: "View", props: {}, style: {} },
      children: [{ kind: "node", templateNodeId: 5 }]
    },
    {
      templateNodeId: 5,
      host: { type: "Text", props: { text: "" }, style: {} },
      children: []
    }
  ],
  bindings: [
    { templateBindingId: 1, scope: { kind: "page" }, target: { templateNodeId: 2, name: "text" } },
    { templateBindingId: 2, scope: { kind: "block", templateBlockId: 1 }, target: { templateNodeId: 5, name: "text" } }
  ],
  blocks: [
    { templateBlockId: 1, kind: "for", parentTemplateNodeId: 1, templateRootNodeId: 4 }
  ],
  handlers: [
    { templateHandlerId: 1, scope: { kind: "page" }, templateNodeId: 3, eventType: "click" }
  ]
};

export const appBootstrap = {
  schemaVersion: 1,
  kind: "app",
  moduleId: "@quickapp-kit/app"
};

export const pageBootstrap = {
  schemaVersion: 1,
  kind: "page",
  moduleId: "@quickapp-kit/page/pages/Demo",
  templateId: "pages/Demo:index"
};

const platformError = runtimeError("PLATFORM_REJECTED", { surfaceId: "srf:case" });

export const branchFixtures = {
  [id("event-message")]: {
    platformInput: {
      schemaVersion: 1,
      kind: "platformInput",
      requestId: "req:input-click",
      surfaceId: "srf:case",
      nodeId: "node:button",
      eventType: "click",
      timestamp: 1,
      payload: {}
    },
    jsDispatch: {
      schemaVersion: 1,
      kind: "jsEventDispatch",
      requestId: "req:input-click",
      surfaceId: "srf:case",
      target: ref("cmp:page", 3),
      currentTarget: ref("cmp:page", 3),
      handlerId: "hdl:click",
      eventType: "click",
      phase: "target",
      timestamp: 1,
      payload: {}
    }
  },
  [id("feature")]: {
    showToastRequest: { schemaVersion: 1, kind: "showToast", requestId: "req:toast", surfaceId: "srf:case", message: "done", durationMs: 0 },
    showToastSuccess: { schemaVersion: 1, kind: "showToastResult", requestId: "req:toast", surfaceId: "srf:case", status: "completed" },
    showToastFailure: { schemaVersion: 1, kind: "showToastResult", requestId: "req:toast-fail", surfaceId: "srf:case", status: "failed", error: platformError },
    deviceGetInfoRequest: { schemaVersion: 1, kind: "deviceGetInfo", requestId: "req:device", surfaceId: "srf:case" },
    deviceGetInfoSuccess: {
      schemaVersion: 1,
      kind: "deviceGetInfoResult",
      requestId: "req:device",
      surfaceId: "srf:case",
      status: "completed",
      info: {
        osType: "android",
        platformVersionName: "1.0.0",
        platformVersionCode: 1,
        screenDensity: 2,
        screenWidth: 720,
        screenHeight: 1280,
        windowWidth: 720,
        windowHeight: 1200,
        deviceType: "phone"
      }
    },
    deviceGetInfoFailure: { schemaVersion: 1, kind: "deviceGetInfoResult", requestId: "req:device-fail", surfaceId: "srf:case", status: "failed", error: runtimeError("CAPABILITY_UNSUPPORTED") },
    setTitleBarRequest: { schemaVersion: 1, kind: "setTitleBar", requestId: "req:title", surfaceId: "srf:case", text: "Title" },
    setTitleBarSuccess: { schemaVersion: 1, kind: "setTitleBarResult", requestId: "req:title", surfaceId: "srf:case", status: "completed" },
    setTitleBarFailure: { schemaVersion: 1, kind: "setTitleBarResult", requestId: "req:title-fail", surfaceId: "srf:case", status: "failed", error: platformError },
    setMetaRequest: { schemaVersion: 1, kind: "setMeta", requestId: "req:meta", surfaceId: "srf:case", title: "Title", description: "Description" },
    setMetaSuccess: { schemaVersion: 1, kind: "setMetaResult", requestId: "req:meta", surfaceId: "srf:case", status: "completed" },
    setMetaFailure: { schemaVersion: 1, kind: "setMetaResult", requestId: "req:meta-fail", surfaceId: "srf:case", status: "failed", error: runtimeError("HOST_FEATURE_UNSUPPORTED") }
  },
  [id("host-component")]: {
    view: { type: "View", props: {}, style: {} },
    text: { type: "Text", props: { text: "hello" }, style: {} },
    button: { type: "Button", props: { text: "go", enabled: true }, style: {} }
  },
  [id("js-bootstrap")]: {
    app: appBootstrap,
    page: pageBootstrap
  },
  [id("lifecycle")]: {
    appContext: {
      schemaVersion: 1,
      kind: "appContext",
      packageId: "com.example.case",
      versionName: "1.0.0",
      versionCode: 1,
      runtimeVersion: "1.0.0",
      declaredCapabilities: ["system.router", "system.prompt"]
    },
    vmInitializationDispatch: {
      schemaVersion: 1,
      kind: "vmInitializationDispatch",
      requestId: "req:initialize-page",
      scope: "page",
      surfaceId: "srf:case"
    },
    vmInitializationSuccess: {
      schemaVersion: 1,
      kind: "vmInitializationResult",
      requestId: "req:initialize-page",
      scope: "page",
      surfaceId: "srf:case",
      status: "completed"
    },
    vmInitializationFailure: {
      schemaVersion: 1,
      kind: "vmInitializationResult",
      requestId: "req:initialize-page-fail",
      scope: "page",
      surfaceId: "srf:case",
      status: "failed",
      failedPhase: "onReady",
      error: runtimeError("JS_EXCEPTION", { surfaceId: "srf:case", requestId: "req:initialize-page-fail" })
    },
    lifecycleDispatch: {
      schemaVersion: 1,
      kind: "lifecycleDispatch",
      requestId: "req:lifecycle-show",
      scope: "page",
      surfaceId: "srf:case",
      hook: "onShow",
      sequence: 1
    },
    lifecycleSuccess: {
      schemaVersion: 1,
      kind: "lifecycleResult",
      requestId: "req:lifecycle-show",
      scope: "page",
      surfaceId: "srf:case",
      hook: "onShow",
      sequence: 1,
      status: "completed"
    },
    lifecycleFailure: {
      schemaVersion: 1,
      kind: "lifecycleResult",
      requestId: "req:lifecycle-hide",
      scope: "page",
      surfaceId: "srf:case",
      hook: "onHide",
      sequence: 2,
      status: "failed",
      error: runtimeError("JS_EXCEPTION", { surfaceId: "srf:case", requestId: "req:lifecycle-hide" })
    },
    hostControlRequest: {
      schemaVersion: 1,
      kind: "runtimeLifecycleControl",
      requestId: "req:foreground",
      action: "enterForeground"
    },
    hostControlSuccess: {
      schemaVersion: 1,
      kind: "runtimeLifecycleControlResult",
      requestId: "req:foreground",
      action: "enterForeground",
      status: "completed",
      runtimeState: "foreground"
    },
    hostControlFailure: {
      schemaVersion: 1,
      kind: "runtimeLifecycleControlResult",
      requestId: "req:background",
      action: "enterBackground",
      status: "failed",
      error: runtimeError("ABI_INVALID_ARGUMENT", { requestId: "req:background" })
    }
  },
  [id("measure-adapter")]: {
    measureRequest: {
      schemaVersion: 1,
      kind: "measureRequest",
      requestId: "req:measure",
      surfaceId: "srf:case",
      nodeId: "node:text",
      contentRevision: 1,
      platformFontGeneration: 1,
      role: "text",
      text: "hello",
      fontToken: "system-default",
      fontSize: 16,
      fontSizeUnit: "logical-px",
      fontWeight: 400,
      widthConstraint: { kind: "atMost", value: 320, unit: "logical-px" },
      heightConstraint: { kind: "unconstrained" }
    },
    measureSuccess: {
      schemaVersion: 1,
      kind: "measureResult",
      requestId: "req:measure",
      surfaceId: "srf:case",
      nodeId: "node:text",
      contentRevision: 1,
      platformFontGeneration: 1,
      status: "measured",
      width: 40,
      height: 20,
      unit: "logical-px"
    },
    measureFailure: {
      schemaVersion: 1,
      kind: "measureResult",
      requestId: "req:measure-fail",
      surfaceId: "srf:case",
      nodeId: "node:text",
      contentRevision: 1,
      platformFontGeneration: 1,
      status: "failed",
      error: runtimeError("MEASURE_FAILED", { surfaceId: "srf:case", requestId: "req:measure-fail" })
    },
    fontGenerationChanged: {
      schemaVersion: 1,
      kind: "platformFontGenerationChanged",
      platformFontGeneration: 2
    }
  },
  [id("module-load")]: {
    loadRequest: {
      schemaVersion: 1,
      kind: "loadVerifiedModule",
      requestId: "req:load-app",
      packageId: "com.example.case",
      moduleKind: "app",
      moduleId: "@quickapp-kit/app",
      cacheScope: "appRuntime",
      bundle: {
        path: "app.js",
        byteLength: 15,
        sha256,
        bytesBase64: "Y29uc29sZS5sb2coMSk7"
      },
      dependencies: [],
      expectedBootstrap: appBootstrap
    },
    loadSuccess: {
      schemaVersion: 1,
      kind: "loadVerifiedModuleResult",
      requestId: "req:load-app",
      moduleKind: "app",
      moduleId: "@quickapp-kit/app",
      status: "loaded"
    },
    loadFailure: {
      schemaVersion: 1,
      kind: "loadVerifiedModuleResult",
      requestId: "req:load-page",
      moduleKind: "page",
      moduleId: "@quickapp-kit/page/pages/Demo",
      surfaceId: "srf:case",
      status: "failed",
      error: runtimeError("MODULE_ABI_UNSUPPORTED", { surfaceId: "srf:case", requestId: "req:load-page" })
    }
  },
  [id("navigation")]: {
    pushRequest: { schemaVersion: 1, kind: "navigationPush", requestId: "req:navigation", sourceSurfaceId: "srf:case", uri: "/pages/Detail", params: {} },
    pushSuccess: { schemaVersion: 1, kind: "navigationPushResult", requestId: "req:navigation", sourceSurfaceId: "srf:case", targetSurfaceId: "srf:detail", status: "presented" },
    pushFailure: { schemaVersion: 1, kind: "navigationPushResult", requestId: "req:navigation-fail", sourceSurfaceId: "srf:case", status: "failed", error: runtimeError("ROUTE_NOT_FOUND") },
    closeRequest: { schemaVersion: 1, kind: "navigationClose", requestId: "req:navigation-close", sourceSurfaceId: "srf:detail" },
    closeSuccess: { schemaVersion: 1, kind: "navigationCloseResult", requestId: "req:navigation-close", sourceSurfaceId: "srf:detail", revealedSurfaceId: "srf:case", status: "closed" },
    closeFailure: { schemaVersion: 1, kind: "navigationCloseResult", requestId: "req:navigation-close-fail", sourceSurfaceId: "srf:case", status: "failed", error: runtimeError("NAVIGATION_FAILED") }
  },
  [id("platform-surface")]: {
    createRequest: { schemaVersion: 1, kind: "createSurfaceHost", requestId: "req:host-create", surfaceId: "srf:case", viewport: { width: 360, height: 640, unit: "logical-px" } },
    createSuccess: { schemaVersion: 1, kind: "createSurfaceHostResult", requestId: "req:host-create", surfaceId: "srf:case", status: "created" },
    createFailure: { schemaVersion: 1, kind: "createSurfaceHostResult", requestId: "req:host-create-fail", surfaceId: "srf:case", status: "failed", error: platformError },
    presentRootRequest: { schemaVersion: 1, kind: "presentSurfaceHost", requestId: "req:present-root", surfaceId: "srf:case", mode: "root" },
    presentPushRequest: { schemaVersion: 1, kind: "presentSurfaceHost", requestId: "req:present-push", surfaceId: "srf:detail", mode: "push", sourceSurfaceId: "srf:case" },
    presentRootSuccess: { schemaVersion: 1, kind: "presentSurfaceHostResult", requestId: "req:present-root", surfaceId: "srf:case", mode: "root", status: "presented" },
    presentPushSuccess: { schemaVersion: 1, kind: "presentSurfaceHostResult", requestId: "req:present-push", surfaceId: "srf:detail", mode: "push", sourceSurfaceId: "srf:case", status: "presented" },
    presentRootFailure: { schemaVersion: 1, kind: "presentSurfaceHostResult", requestId: "req:present-root-fail", surfaceId: "srf:case", mode: "root", status: "failed", error: runtimeError("SURFACE_PRESENTATION_FAILED") },
    presentPushFailure: { schemaVersion: 1, kind: "presentSurfaceHostResult", requestId: "req:present-push-fail", surfaceId: "srf:detail", mode: "push", sourceSurfaceId: "srf:case", status: "failed", error: runtimeError("SURFACE_PRESENTATION_FAILED") },
    visibilityRequest: { schemaVersion: 1, kind: "setSurfaceVisibility", requestId: "req:visibility", surfaceId: "srf:case", visibility: "hidden" },
    visibilitySuccess: { schemaVersion: 1, kind: "setSurfaceVisibilityResult", requestId: "req:visibility", surfaceId: "srf:case", visibility: "hidden", status: "completed" },
    visibilityFailure: { schemaVersion: 1, kind: "setSurfaceVisibilityResult", requestId: "req:visibility-fail", surfaceId: "srf:case", visibility: "hidden", status: "failed", error: platformError },
    closeRequest: { schemaVersion: 1, kind: "closeSurfaceHost", requestId: "req:host-close", surfaceId: "srf:detail", revealSurfaceId: "srf:case" },
    closeSuccess: { schemaVersion: 1, kind: "closeSurfaceHostResult", requestId: "req:host-close", surfaceId: "srf:detail", revealSurfaceId: "srf:case", status: "completed" },
    closeFailure: { schemaVersion: 1, kind: "closeSurfaceHostResult", requestId: "req:host-close-fail", surfaceId: "srf:detail", revealSurfaceId: "srf:case", status: "failed", error: platformError },
    destroyRequest: { schemaVersion: 1, kind: "destroySurfaceHost", requestId: "req:host-destroy", surfaceId: "srf:case" },
    destroySuccess: { schemaVersion: 1, kind: "destroySurfaceHostResult", requestId: "req:host-destroy", surfaceId: "srf:case", status: "destroyed" },
    destroyFailure: { schemaVersion: 1, kind: "destroySurfaceHostResult", requestId: "req:host-destroy-fail", surfaceId: "srf:case", status: "failed", error: platformError }
  },
  [id("runtime-abi")]: {
    instantiateTemplate: {
      schemaVersion: 1,
      kind: "instantiateTemplate",
      requestId: "req:instantiate",
      surfaceId: "srf:case",
      templateId: "pages/Demo:index",
      ownerInstanceId: "cmp:page",
      initialBindings: { "1": "hello" },
      initialBlocks: [
        {
          kind: "instantiateBlock",
          templateBlockId: 1,
          blockInstanceId: "blk:item-a",
          parent: ref("cmp:page", 1),
          index: 2,
          key: "a",
          initialBindings: { "2": "A" },
          handlers: []
        }
      ],
      initialHandlers: [
        { ownerInstanceId: "cmp:page", templateHandlerId: 1, handlerId: "hdl:click" }
      ]
    },
    registerHandler: { schemaVersion: 1, kind: "registerHandler", requestId: "req:register", surfaceId: "srf:case", ownerInstanceId: "cmp:page", templateHandlerId: 1, handlerId: "hdl:dynamic" },
    unregisterHandler: { schemaVersion: 1, kind: "unregisterHandler", requestId: "req:unregister", surfaceId: "srf:case", handlerId: "hdl:dynamic" }
  },
  [id("surface-control")]: {
    createRequest: { schemaVersion: 1, kind: "createSurface", requestId: "req:create", packageId: "com.example.case", route: "/pages/Demo", params: {}, viewport: { width: 360, height: 640, unit: "logical-px" } },
    createSuccess: { schemaVersion: 1, kind: "createSurfaceResult", requestId: "req:create", status: "presented", surfaceId: "srf:case", route: "/pages/Demo" },
    createFailure: { schemaVersion: 1, kind: "createSurfaceResult", requestId: "req:create-fail", status: "failed", error: runtimeError("ROUTE_NOT_FOUND") },
    surfaceContext: { schemaVersion: 1, kind: "surfaceContext", surfaceId: "srf:case", packageId: "com.example.case", route: "/pages/Demo", templateId: "pages/Demo:index", params: {}, hostCapabilities: ["setTitleBar", "setMeta"], viewport: { width: 360, height: 640, unit: "logical-px" } },
    destroyRequest: { schemaVersion: 1, kind: "destroySurface", requestId: "req:destroy", surfaceId: "srf:case" },
    destroySuccess: { schemaVersion: 1, kind: "destroySurfaceResult", requestId: "req:destroy", status: "destroyed", surfaceId: "srf:case" },
    destroyFailure: { schemaVersion: 1, kind: "destroySurfaceResult", requestId: "req:destroy-fail", status: "failed", surfaceId: "srf:case", error: platformError },
    instantiateSuccess: { schemaVersion: 1, kind: "instantiateTemplateResult", requestId: "req:instantiate", status: "presented", surfaceId: "srf:case", committedRevision: 0 },
    instantiateFailure: { schemaVersion: 1, kind: "instantiateTemplateResult", requestId: "req:instantiate-fail", status: "failed", surfaceId: "srf:case", error: runtimeError("SURFACE_FAILED") },
    handlerSuccess: { schemaVersion: 1, kind: "handlerRegistrationResult", requestId: "req:register", operation: "register", status: "registered", surfaceId: "srf:case", handlerId: "hdl:click" },
    handlerFailure: { schemaVersion: 1, kind: "handlerRegistrationResult", requestId: "req:register-fail", operation: "register", status: "failed", surfaceId: "srf:case", handlerId: "hdl:click", error: runtimeError("HANDLER_ALREADY_EXISTS") },
    surfaceStatus: { schemaVersion: 1, kind: "surfaceStatusChanged", surfaceId: "srf:case", lifecycleState: "visible", healthState: "normal", committedRevision: 0 }
  },
  [id("transaction-result")]: {
    renderPresented: { schemaVersion: 1, kind: "renderTransactionResult", surfaceId: "srf:case", transactionId: "txn:one", submittedRevision: 1, committedRevision: 1, status: "presented" },
    renderRejected: { schemaVersion: 1, kind: "renderTransactionResult", surfaceId: "srf:case", transactionId: "txn:stale", submittedRevision: 1, committedRevision: 0, status: "rejected", error: runtimeError("REVISION_STALE") },
    renderPresentationFailed: { schemaVersion: 1, kind: "renderTransactionResult", surfaceId: "srf:case", transactionId: "txn:failed", submittedRevision: 1, committedRevision: 1, status: "presentationFailed", error: runtimeError("SURFACE_FAILED") },
    mountSucceeded: { schemaVersion: 1, kind: "mountTransactionResult", surfaceId: "srf:case", mountAttemptId: "mnt:one", sourceId: "txn:one", revision: 1, status: "mounted", recovery: "none" },
    mountRecoverableFailure: { schemaVersion: 1, kind: "mountTransactionResult", surfaceId: "srf:case", mountAttemptId: "mnt:two", sourceId: "txn:one", revision: 1, status: "failed", recovery: "rebuildSurface", error: platformError },
    mountTerminalFailure: { schemaVersion: 1, kind: "mountTransactionResult", surfaceId: "srf:case", mountAttemptId: "mnt:three", sourceId: "txn:one", revision: 1, status: "failed", recovery: "recreateSurface", error: runtimeError("SURFACE_FAILED") }
  }
};

export const schemaFixtures = {
  [id("manifest")]: manifest,
  [id("runtime-metadata")]: runtimeMetadata,
  [id("runtime-composition")]: {
    schemaVersion: 1,
    kind: "runtimeCompositionManifest",
    profileId: "lvgl-embedded-min",
    target: "lvgl-embedded",
    runtimeAbi: "quickapp-kit-runtime-v1",
    conformance: "v1",
    buildMode: "release",
    observationLevel: "baseline",
    jsEngine: {
      engineId: "quickjs",
      engineVersion: "v1",
      engineAbi: "quickapp-kit-js-engine-v1",
      moduleId: "engine.quickjs"
    },
    linkedModules: [
      { moduleId: "kernel.bridge", category: "kernel" },
      { moduleId: "kernel.render", category: "kernel" },
      { moduleId: "kernel.event", category: "kernel" },
      { moduleId: "kernel.lifecycle", category: "kernel" },
      { moduleId: "kernel.runtime-tree", category: "kernel" },
      { moduleId: "kernel.transaction", category: "kernel" },
      { moduleId: "runtime.js-framework", category: "runtime" },
      { moduleId: "engine.quickjs", category: "engine" },
      { moduleId: "platform.lvgl", category: "platform" }
    ],
    components: ["View", "Text", "Button"],
    capabilities: ["system.router", "system.prompt", "system.device"],
    binaryBytes: 131072,
    staticMemoryBytes: 32768
  },
  [id("page-ir")]: pageIr,
  [id("observation")]: {
    schemaVersion: 1,
    kind: "observationMarker",
    runId: "run:case-001",
    producer: "core",
    markerName: "render.transaction.presented",
    timestampNs: 100,
    clockDomain: "core-monotonic",
    sequence: 1,
    artifactSha256: sha256,
    appRuntimeId: "app:case",
    surfaceId: "srf:case",
    transactionId: "txn:update",
    revision: 1,
    operationCount: 1,
    logicalPayloadBytes: 64
  },
  [id("runtime-error")]: runtimeError("PLATFORM_REJECTED", { surfaceId: "srf:case" }),
  [id("runtime-value")]: { nested: [null, true, 1, 1.5, "value"] },
  [id("render-transaction")]: {
    schemaVersion: 1,
    surfaceId: "srf:case",
    revision: 1,
    transactionId: "txn:update",
    operations: [
      { kind: "updateBinding", ownerInstanceId: "cmp:page", templateBindingId: 1, value: "next" },
      { kind: "updateBinding", ownerInstanceId: "blk:item-a", templateBindingId: 2, value: "A2" },
      { kind: "instantiateBlock", templateBlockId: 1, blockInstanceId: "blk:item-b", parent: ref("cmp:page", 1), index: 2, key: "b", initialBindings: { "2": "B" }, handlers: [] },
      { kind: "moveBlock", blockInstanceId: "blk:item-a", parent: ref("cmp:page", 1), index: 3 },
      { kind: "removeBlock", blockInstanceId: "blk:item-c" }
    ]
  },
  [id("mount-transaction")]: {
    schemaVersion: 1,
    surfaceId: "srf:case",
    revision: 1,
    mountAttemptId: "mnt:update",
    sourceId: "txn:update",
    mode: "incremental",
    operations: [
      { kind: "createHost", nodeId: "node:new", type: "Text" },
      { kind: "setHostProp", nodeId: "node:new", name: "text", value: "hello" },
      { kind: "setHostProp", nodeId: "node:button", name: "enabled", value: true },
      { kind: "setHostProp", nodeId: "node:new", name: "color", value: "#000000" },
      { kind: "setHostProp", nodeId: "node:new", name: "fontSize", value: 16 },
      { kind: "setHostProp", nodeId: "node:new", name: "textAlign", value: "center" },
      { kind: "setHostLayout", nodeId: "node:new", layout: { x: 0, y: 0, width: 100, height: 20, unit: "logical-px" } },
      { kind: "insertHostChild", nodeId: "node:new", parentNodeId: "node:root", index: 0 },
      { kind: "moveHost", nodeId: "node:existing", newParentNodeId: "node:root", index: 1 },
      { kind: "removeHost", nodeId: "node:old" }
    ]
  },
  [id("package-open-policy")]: {
    schemaVersion: 1,
    verificationMode: "release",
    allowUnsigned: false,
    trustedKeys: [
      {
        keyId: "release-2026",
        algorithm: "Ed25519",
        publicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
      }
    ]
  }
};

export const supplementalPositiveFixtures = [
  [id("runtime-composition"), {
    ...schemaFixtures[id("runtime-composition")],
    profileId: "lvgl-router-only",
    conformance: "custom",
    components: ["View", "Text"],
    capabilities: ["system.router"]
  }, "custom Runtime composition may trim peripheral components and capabilities"],
  [id("runtime-composition"), {
    ...schemaFixtures[id("runtime-composition")],
    profileId: "lvgl-headless-off",
    conformance: "custom",
    observationLevel: "off",
    components: ["View"],
    capabilities: []
  }, "custom Runtime composition may use Noop observation"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:failed", producer: "toolkit", markerName: "build.failed", timestampNs: 10, clockDomain: "toolkit", sequence: 1, errorCode: "TK_BUILD_FAILED" }, "Observation failure with errorCode"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:memory", producer: "platform", markerName: "memory.sampled", timestampNs: 20, clockDomain: "platform", sequence: 1, memoryBytes: 4096, metricKind: "rss", samplingPhase: "steady" }, "Observation memory sample"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:bridge", producer: "core", markerName: "bridge.request.enqueued", timestampNs: 21, clockDomain: "core-monotonic", sequence: 1, requestId: "req:bridge" }, "Bridge request marker"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:event", producer: "platform", markerName: "event.input.captured", timestampNs: 21, clockDomain: "platform-monotonic", sequence: 1, requestId: "req:input-click", surfaceId: "srf:case", nodeId: "node:button" }, "Event input marker with RequestId"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:event", producer: "js", markerName: "event.handler.started", timestampNs: 22, clockDomain: "js-monotonic", sequence: 1, requestId: "req:input-click", surfaceId: "srf:case", handlerId: "hdl:click" }, "Event Handler marker with RequestId"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:counter", producer: "core", markerName: "runtime.counter.sampled", timestampNs: 22, clockDomain: "core-monotonic", sequence: 1, counterName: "runtime.node.live", counterValue: 12 }, "Runtime counter sample"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:overflow", producer: "core", markerName: "queue.overflow", timestampNs: 23, clockDomain: "core-monotonic", sequence: 1, counterName: "queue.depth", counterValue: 64, errorCode: "QUEUE_OVERFLOW" }, "Runtime queue overflow"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:rebuild", producer: "core", markerName: "mount.full-rebuild.failed", timestampNs: 24, clockDomain: "core-monotonic", sequence: 1, surfaceId: "srf:case", mountAttemptId: "mnt:rebuild", errorCode: "PLATFORM_REJECTED" }, "Full rebuild failure"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:oom", producer: "core", markerName: "runtime.oom", timestampNs: 25, clockDomain: "core-monotonic", sequence: 1, errorCode: "OUT_OF_MEMORY" }, "Runtime OOM"],
  [id("render-transaction"), { ...schemaFixtures[id("render-transaction")], transactionId: "txn:event-update", requestId: "req:input-click" }, "Render transaction caused by synchronous input"],
  [id("runtime-error"), runtimeError("OUT_OF_MEMORY"), "Runtime OOM typed error"],
  [id("runtime-error"), runtimeError("QUEUE_OVERFLOW"), "Runtime queue overflow typed error"],
  [id("surface-control"), { schemaVersion: 1, kind: "handlerRegistrationResult", requestId: "req:unregister", operation: "unregister", status: "unregistered", surfaceId: "srf:case", handlerId: "hdl:click" }, "handler unregister success"],
  [id("mount-transaction"), { schemaVersion: 1, surfaceId: "srf:case", revision: 0, mountAttemptId: "mnt:initial", sourceId: "req:instantiate", mode: "full", operations: [{ kind: "createHost", nodeId: "node:root", type: "View" }] }, "full Mount"],
  [id("transaction-result"), { schemaVersion: 1, kind: "renderTransactionResult", surfaceId: "srf:case", transactionId: "txn:cancelled", submittedRevision: 2, committedRevision: 1, status: "cancelled", error: runtimeError("SURFACE_NOT_FOUND") }, "render cancelled"],
  [id("module-load"), {
    schemaVersion: 1,
    kind: "loadVerifiedModule",
    requestId: "req:load-page",
    packageId: "com.example.case",
    moduleKind: "page",
    moduleId: "@quickapp-kit/page/pages/Demo",
    cacheScope: "surface",
    surfaceId: "srf:case",
    bundle: { path: "pages/Demo/index.js", byteLength: 1, sha256, bytesBase64: "YQ==" },
    dependencies: [],
    expectedBootstrap: pageBootstrap,
    expectedBindingIds: [1, 2],
    expectedHandlerIds: [1]
  }, "verified Page module request"],
  [id("module-load"), { schemaVersion: 1, kind: "loadVerifiedModuleResult", requestId: "req:load-page", moduleKind: "page", moduleId: "@quickapp-kit/page/pages/Demo", surfaceId: "srf:case", status: "loaded" }, "verified Page module success"],
  [id("lifecycle"), { schemaVersion: 1, kind: "lifecycleDispatch", requestId: "req:app-show", scope: "app", hook: "onShow", sequence: 1 }, "App lifecycle dispatch without Surface"],
  [id("lifecycle"), { schemaVersion: 1, kind: "lifecycleResult", requestId: "req:app-show", scope: "app", hook: "onShow", sequence: 1, status: "completed" }, "App lifecycle result without Surface"],
  [id("lifecycle"), { schemaVersion: 1, kind: "runtimeLifecycleControlResult", requestId: "req:destroy-runtime", action: "destroyAppRuntime", status: "completed", runtimeState: "destroyed" }, "Host destroy lifecycle result"]
];

export const negativeFixtures = [
  [id("runtime-composition"), {
    ...schemaFixtures[id("runtime-composition")],
    linkedModules: schemaFixtures[id("runtime-composition")].linkedModules.filter(({ moduleId }) => moduleId !== "kernel.event")
  }, "Runtime composition without Event kernel"],
  [id("runtime-composition"), {
    ...schemaFixtures[id("runtime-composition")],
    components: ["View", "Text"]
  }, "V1 Runtime composition without Button"],
  [id("runtime-composition"), {
    ...schemaFixtures[id("runtime-composition")],
    observationLevel: "off"
  }, "V1 Runtime composition cannot disable baseline observation"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:case", producer: "core", markerName: "private.render.done", timestampNs: 1, clockDomain: "core", sequence: 0 }, "unknown Observation marker"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:unsafe-integer", producer: "core", markerName: "package.open.started", timestampNs: 9007199254740992, clockDomain: "core", sequence: 0 }, "Observation wire integer above JavaScript safe range"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:failed", producer: "toolkit", markerName: "build.failed", timestampNs: 1, clockDomain: "toolkit", sequence: 0 }, "Observation failure without errorCode"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:memory", producer: "platform", markerName: "memory.sampled", timestampNs: 1, clockDomain: "platform", sequence: 0, memoryBytes: 4096 }, "Observation memory sample without kind and phase"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:memory-field", producer: "core", markerName: "render.transaction.presented", timestampNs: 1, clockDomain: "core", sequence: 0, memoryBytes: 4096 }, "Observation memoryBytes without kind and phase"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:bridge", producer: "core", markerName: "bridge.request.enqueued", timestampNs: 1, clockDomain: "core", sequence: 0 }, "Bridge marker without RequestId"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:event", producer: "platform", markerName: "event.input.captured", timestampNs: 1, clockDomain: "platform", sequence: 0, surfaceId: "srf:case", nodeId: "node:button" }, "Event marker without RequestId"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:counter", producer: "core", markerName: "runtime.counter.sampled", timestampNs: 1, clockDomain: "core", sequence: 0, counterName: "handler.live" }, "Runtime counter without value"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:overflow", producer: "core", markerName: "queue.overflow", timestampNs: 1, clockDomain: "core", sequence: 0, counterName: "handler.live", counterValue: 1, errorCode: "QUEUE_OVERFLOW" }, "Queue overflow with wrong counter"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:rebuild", producer: "core", markerName: "mount.full-rebuild.failed", timestampNs: 1, clockDomain: "core", sequence: 0, surfaceId: "srf:case", errorCode: "PLATFORM_REJECTED" }, "Full rebuild marker without attempt ID"],
  [id("observation"), { schemaVersion: 1, kind: "observationMarker", runId: "run:oom", producer: "core", markerName: "runtime.oom", timestampNs: 1, clockDomain: "core", sequence: 0 }, "Runtime OOM without errorCode"],
  [id("feature"), { schemaVersion: 1, kind: "featureRequest", requestId: "req:generic", surfaceId: "srf:case", feature: "system.prompt", method: "showToast", args: {} }, "generic Feature bridge"],
  [id("surface-control"), { schemaVersion: 1, kind: "controlOperationResult", requestId: "req:old", status: "failed", operation: "createSurface", error: runtimeError("ROUTE_NOT_FOUND") }, "generic control failure"],
  [id("event-message"), { schemaVersion: 1, kind: "platformInput", requestId: "req:input", surfaceId: "case", nodeId: "node:button", eventType: "click", timestamp: 1, payload: {} }, "ID prefix"],
  [id("event-message"), { schemaVersion: 1, kind: "platformInput", surfaceId: "srf:case", nodeId: "node:button", eventType: "click", timestamp: 1, payload: {} }, "Platform input without RequestId"],
  [id("event-message"), { schemaVersion: 1, kind: "jsEventDispatch", surfaceId: "srf:case", target: ref("cmp:page", 3), currentTarget: ref("cmp:page", 3), handlerId: "hdl:click", eventType: "click", phase: "target", timestamp: 1, payload: {} }, "JS event dispatch without RequestId"],
  [id("render-transaction"), { schemaVersion: 1, surfaceId: "srf:case", revision: 0, transactionId: "txn:zero", operations: [] }, "revision zero"],
  [id("render-transaction"), { ...schemaFixtures[id("render-transaction")], requestId: "input-without-prefix" }, "Render transaction with invalid input RequestId"],
  [id("render-transaction"), { schemaVersion: 1, surfaceId: "srf:case", revision: 1, transactionId: "txn:direct-prop", operations: [{ kind: "updateProp", target: ref("cmp:page", 2), name: "text", value: "noise" }] }, "direct UpdateProp is not a JS ABI operation"],
  [id("render-transaction"), { schemaVersion: 1, surfaceId: "srf:case", revision: 1, transactionId: "txn:bad-block", operations: [{ kind: "instantiateBlock", templateBlockId: 1, blockInstanceId: "blk:item", parent: ref("cmp:page", 1), index: 0, handlers: [] }] }, "Block without initial bindings"],
  [id("render-transaction"), { schemaVersion: 1, surfaceId: "srf:case", revision: 1, transactionId: "txn:bad-block-handler-owner", operations: [{ kind: "instantiateBlock", templateBlockId: 1, blockInstanceId: "blk:item", parent: ref("cmp:page", 1), index: 0, initialBindings: {}, handlers: [{ ownerInstanceId: "cmp:page", templateHandlerId: 1, handlerId: "hdl:item" }] }] }, "Block Handler with Page owner"],
  [id("mount-transaction"), { schemaVersion: 1, surfaceId: "srf:case", revision: 0, mountAttemptId: "mnt:bad-full", sourceId: "req:instantiate", mode: "full", operations: [{ kind: "moveHost", nodeId: "node:a", newParentNodeId: "node:root", index: 0 }] }, "MoveHost in full Mount"],
  [id("transaction-result"), { schemaVersion: 1, kind: "mountTransactionResult", surfaceId: "srf:case", mountAttemptId: "mnt:bad", sourceId: "txn:one", revision: 1, status: "failed", recovery: "none", error: platformError }, "invalid Mount recovery"],
  [id("navigation"), { schemaVersion: 1, kind: "navigationPushResult", requestId: "req:bad", sourceSurfaceId: "srf:case", status: "failed" }, "Navigation failure without error"],
  [id("runtime-abi"), { schemaVersion: 1, kind: "instantiateTemplate", requestId: "req:bad", surfaceId: "srf:case", templateId: "pages/Demo:index", ownerInstanceId: "cmp:page", initialBindings: {}, initialHandlers: [] }, "InstantiateTemplate without initialBlocks"],
  [id("runtime-abi"), { schemaVersion: 1, kind: "instantiateTemplate", requestId: "req:number-binding", surfaceId: "srf:case", templateId: "pages/Demo:index", ownerInstanceId: "cmp:page", initialBindings: { "1": 1 }, initialBlocks: [], initialHandlers: [] }, "numeric initial Binding"],
  [id("runtime-abi"), { schemaVersion: 1, kind: "instantiateTemplate", requestId: "req:block-owner", surfaceId: "srf:case", templateId: "pages/Demo:index", ownerInstanceId: "cmp:page", initialBindings: {}, initialBlocks: [], initialHandlers: [{ ownerInstanceId: "blk:item", templateHandlerId: 1, handlerId: "hdl:bad" }] }, "Page Handler with Block owner"],
  [id("runtime-abi"), { schemaVersion: 1, kind: "registerHandler", requestId: "req:legacy", surfaceId: "srf:case", target: ref("cmp:page", 3), eventType: "click", handlerId: "hdl:legacy" }, "direct Handler target is not a JS ABI input"],
  [id("module-load"), { schemaVersion: 1, kind: "loadVerifiedModule", requestId: "req:page-without-contract", packageId: "com.example.case", moduleKind: "page", moduleId: "@quickapp-kit/page/pages/Demo", cacheScope: "surface", bundle: { path: "pages/Demo/index.js", byteLength: 1, sha256, bytesBase64: "YQ==" }, dependencies: [] }, "Page module without Surface and expected exports"],
  [id("lifecycle"), { schemaVersion: 1, kind: "lifecycleDispatch", requestId: "req:bad-app-surface", scope: "app", surfaceId: "srf:case", hook: "onShow", sequence: 1 }, "App lifecycle with Surface"],
  [id("lifecycle"), { schemaVersion: 1, kind: "vmInitializationResult", requestId: "req:bad-app-init", scope: "app", status: "failed", failedPhase: "onInit", error: runtimeError("JS_EXCEPTION") }, "App initialization with Page phase"],
  [id("lifecycle"), { schemaVersion: 1, kind: "runtimeLifecycleControlResult", requestId: "req:bad-foreground", action: "enterForeground", status: "completed", runtimeState: "background" }, "Host lifecycle action/state mismatch"],
  [id("measure-adapter"), { schemaVersion: 1, kind: "measureResult", requestId: "req:bad-measure", surfaceId: "srf:case", nodeId: "node:text", contentRevision: 1, platformFontGeneration: 1, status: "failed" }, "Measure failure without RuntimeError"],
  [id("measure-adapter"), { schemaVersion: 1, kind: "measureResult", requestId: "req:bad-measure-code", surfaceId: "srf:case", nodeId: "node:text", contentRevision: 1, platformFontGeneration: 1, status: "failed", error: runtimeError("PLATFORM_REJECTED") }, "Measure failure with non-measure error"],
  [id("runtime-metadata"), { ...runtimeMetadata, app: { ...runtimeMetadata.app, bundle: artifact("../app.js", "application/javascript") } }, "path traversal"],
  [id("runtime-metadata"), { ...runtimeMetadata, packageFormat: "legacy-rpk" }, "unsupported package format"],
  [id("package-open-policy"), { schemaVersion: 1, verificationMode: "release", allowUnsigned: true, trustedKeys: [] }, "release policy cannot allow unsigned"],
  [id("host-component"), { type: "View", props: {}, style: { width: { value: -1, unit: "logical-px" } } }, "negative width"],
  [id("js-bootstrap"), { schemaVersion: 1, kind: "page", moduleId: "@quickapp-kit/page/pages/Demo" }, "Page bootstrap without template"],
  [id("runtime-error"), { code: "UNKNOWN", message: "unknown", retryable: false }, "unknown error code"],
  [id("manifest"), { package: "com.example.case", versionName: "1.0.0", versionCode: 1, minPlatformVersion: 1000 }, "Manifest without router"]
];

export const runtimeCompositionSemanticNegatives = [
  [{
    ...schemaFixtures[id("runtime-composition")],
    linkedModules: [
      ...schemaFixtures[id("runtime-composition")].linkedModules,
      { moduleId: "kernel.bridge", category: "runtime" }
    ]
  }, "duplicate linked module ID"],
  [{
    ...schemaFixtures[id("runtime-composition")],
    jsEngine: {
      ...schemaFixtures[id("runtime-composition")].jsEngine,
      moduleId: "engine.missing"
    }
  }, "selected JS engine is not linked"],
  [{
    ...schemaFixtures[id("runtime-composition")],
    linkedModules: [
      ...schemaFixtures[id("runtime-composition")].linkedModules,
      { moduleId: "engine.alternative", category: "engine" }
    ]
  }, "more than one JS engine is linked"],
  [{
    ...schemaFixtures[id("runtime-composition")],
    linkedModules: schemaFixtures[id("runtime-composition")].linkedModules.filter(({ moduleId }) => moduleId !== "runtime.js-framework")
  }, "JS Framework module is missing"],
  [{
    ...schemaFixtures[id("runtime-composition")],
    linkedModules: schemaFixtures[id("runtime-composition")].linkedModules.map((module) => module.moduleId === "runtime.js-framework" ? { ...module, category: "diagnostic" } : module)
  }, "JS Framework module has wrong category"],
  [{
    ...schemaFixtures[id("runtime-composition")],
    linkedModules: [
      ...schemaFixtures[id("runtime-composition")].linkedModules,
      { moduleId: "runtime.js-framework", category: "runtime" }
    ]
  }, "JS Framework module is duplicated"]
];

export const artifactSet = {
  manifest,
  runtimeMetadata,
  pageIrsByPath: {
    "quickapp-kit/pages/Demo/index.ir.json": pageIr
  },
  bootstrapsByPath: {
    "app.js": appBootstrap,
    "pages/Demo/index.js": pageBootstrap
  }
};

export const signatureGolden = {
  keyId: "release-2026",
  privateKeySeedHex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  publicKeyBase64url: "A6EHv_POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg",
  expectedPayloadSha256: "a6638d3c35943b05653f85acd57f933857b039a815f2c70b3e8932334adca31a",
  expectedSignatureBase64url: "ZQ2RqtuR5o-toE95aR91stjbjyYL-IJi4bqCMLRmA2PIOAQLmh4p-6ralwoe7mVsIkwFJja-swC3GXqqFdAcCQ",
  members: [
    { path: "META-INF/build.txt", content: "case-001\n" },
    { path: "app.js", content: "$app_bootstrap$(\"@quickapp-kit/app\")\n" },
    { path: "manifest.json", content: "{\"package\":\"com.example.case\"}\n" },
    { path: "quickapp-kit/runtime.json", content: "{\"packageFormat\":\"quickapp-kit-rpk-v1\"}\n" }
  ]
};
