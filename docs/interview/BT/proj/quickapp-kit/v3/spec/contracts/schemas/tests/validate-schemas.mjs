import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactSet,
  branchFixtures,
  negativeFixtures,
  runtimeCompositionSemanticNegatives,
  schemaFixtures,
  signatureGolden,
  supplementalPositiveFixtures
} from "./fixtures.mjs";

const ajvModule = process.env.AJV_MODULE ?? "ajv/dist/2020.js";
const { default: Ajv2020 } = await import(ajvModule);

const testDir = dirname(fileURLToPath(import.meta.url));
const schemaDir = resolve(testDir, "..");
const catalog = JSON.parse(await readFile(resolve(schemaDir, "catalog.json"), "utf8"));
const schemas = new Map();
const ajv = new Ajv2020({ allErrors: true, strict: true });

for (const entry of catalog.schemas) {
  const schema = JSON.parse(await readFile(resolve(schemaDir, entry.file), "utf8"));
  if (schema.$id !== entry.id) {
    throw new Error(`Catalog mismatch: ${entry.file}`);
  }
  schemas.set(entry.id, schema);
  ajv.addSchema(schema);
}

for (const entry of catalog.schemas) {
  if (!ajv.getSchema(entry.id)) {
    throw new Error(`Schema did not compile: ${entry.id}`);
  }
}

function assertValidation(id, value, expected, label) {
  const validate = ajv.getSchema(id);
  const actual = validate(value);
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}\n${ajv.errorsText(validate.errors)}`);
  }
}

let branchCount = 0;
for (const [id, schema] of schemas) {
  if (!schema.oneOf) {
    const fixture = schemaFixtures[id];
    if (fixture === undefined) {
      throw new Error(`Missing positive fixture for ${id}`);
    }
    assertValidation(id, fixture, true, id);
    continue;
  }

  const expectedBranches = schema.oneOf.map(({ $ref }) => $ref.split("/").at(-1)).sort();
  const fixtures = branchFixtures[id] ?? {};
  const actualBranches = Object.keys(fixtures).sort();
  if (JSON.stringify(expectedBranches) !== JSON.stringify(actualBranches)) {
    throw new Error(`Branch coverage mismatch for ${id}\nexpected=${expectedBranches}\nactual=${actualBranches}`);
  }

  for (const [branch, fixture] of Object.entries(fixtures)) {
    const validateBranch = ajv.compile({ $ref: `${id}#/$defs/${branch}` });
    if (!validateBranch(fixture)) {
      throw new Error(`${id}#${branch}: ${ajv.errorsText(validateBranch.errors)}`);
    }
    assertValidation(id, fixture, true, `${id}#${branch}`);
    assertValidation(id, { ...fixture, __unexpected: true }, false, `${id}#${branch} additionalProperties`);
    branchCount += 1;
  }
}

for (const [id, fixture, label] of supplementalPositiveFixtures) {
  assertValidation(id, fixture, true, label);
}

for (const [id, fixture, label] of negativeFixtures) {
  assertValidation(id, fixture, false, label);
}

function validateRuntimeCompositionSemantics(manifest) {
  const errors = [];
  const moduleIds = manifest.linkedModules.map(({ moduleId }) => moduleId);
  if (new Set(moduleIds).size !== moduleIds.length) errors.push("duplicate linked module ID");
  const engineModules = manifest.linkedModules.filter(({ category }) => category === "engine");
  if (engineModules.length !== 1 || engineModules[0].moduleId !== manifest.jsEngine.moduleId) {
    errors.push("selected JS engine must be the only linked engine module");
  }
  const jsFrameworkModules = manifest.linkedModules.filter(({ moduleId, category }) => moduleId === "runtime.js-framework" && category === "runtime");
  if (jsFrameworkModules.length !== 1) errors.push("JS Framework runtime module must be linked exactly once");
  return errors;
}

const runtimeCompositionId = "https://quickapp-kit.dev/v1/runtime-composition.schema.json";
if (validateRuntimeCompositionSemantics(schemaFixtures[runtimeCompositionId]).length) {
  throw new Error("valid Runtime composition failed semantic validation");
}
for (const [fixture, label] of runtimeCompositionSemanticNegatives) {
  if (!validateRuntimeCompositionSemantics(fixture).length) {
    throw new Error(`${label}: expected semantic failure`);
  }
}

function validatePageIrSemantics(pageIr) {
  const errors = [];
  const unique = (items, field, label) => {
    const values = items.map((item) => item[field]);
    if (new Set(values).size !== values.length) errors.push(`duplicate ${label}`);
    return new Set(values);
  };
  const nodeIds = unique(pageIr.nodes, "templateNodeId", "TemplateNodeId");
  const blockIds = unique(pageIr.blocks, "templateBlockId", "TemplateBlockId");
  unique(pageIr.bindings, "templateBindingId", "TemplateBindingId");
  unique(pageIr.handlers, "templateHandlerId", "TemplateHandlerId");
  const nodeMap = new Map(pageIr.nodes.map((node) => [node.templateNodeId, node]));
  const blockMap = new Map(pageIr.blocks.map((block) => [block.templateBlockId, block]));
  const nodeKey = (value) => `node:${value}`;
  const blockKey = (value) => `block:${value}`;
  const entityKeys = [
    ...pageIr.nodes.map((node) => nodeKey(node.templateNodeId)),
    ...pageIr.blocks.map((block) => blockKey(block.templateBlockId))
  ];
  const adjacency = new Map(entityKeys.map((key) => [key, []]));
  const indegree = new Map(entityKeys.map((key) => [key, 0]));
  const blockSlotParents = new Map();
  const addEdge = (from, to) => {
    adjacency.get(from)?.push(to);
    if (indegree.has(to)) indegree.set(to, indegree.get(to) + 1);
  };

  if (!nodeIds.has(pageIr.rootTemplateNodeId)) errors.push("missing root node");
  for (const node of pageIr.nodes) {
    for (const child of node.children) {
      if (child.kind === "node") {
        if (!nodeIds.has(child.templateNodeId)) errors.push("missing child node");
        else addEdge(nodeKey(node.templateNodeId), nodeKey(child.templateNodeId));
      }
      if (child.kind === "block") {
        if (!blockIds.has(child.templateBlockId)) errors.push("missing child block");
        else {
          addEdge(nodeKey(node.templateNodeId), blockKey(child.templateBlockId));
          const parents = blockSlotParents.get(child.templateBlockId) ?? [];
          parents.push(node.templateNodeId);
          blockSlotParents.set(child.templateBlockId, parents);
        }
      }
    }
  }
  for (const block of pageIr.blocks) {
    if (!nodeIds.has(block.parentTemplateNodeId)) errors.push("missing block parent");
    if (!nodeIds.has(block.templateRootNodeId)) errors.push("missing block root");
    else addEdge(blockKey(block.templateBlockId), nodeKey(block.templateRootNodeId));
    const slotParents = blockSlotParents.get(block.templateBlockId) ?? [];
    if (slotParents.length !== 1 || slotParents[0] !== block.parentTemplateNodeId) {
      errors.push(`block parent slot mismatch ${block.templateBlockId}`);
    }
  }

  const rootKey = nodeKey(pageIr.rootTemplateNodeId);
  if (indegree.has(rootKey) && indegree.get(rootKey) !== 0) errors.push("root indegree must be zero");
  for (const key of entityKeys) {
    if (key !== rootKey && indegree.get(key) !== 1) errors.push(`invalid structural indegree ${key}`);
  }

  const colors = new Map();
  const visitForCycle = (key) => {
    if (colors.get(key) === 1) {
      errors.push(`structural cycle ${key}`);
      return;
    }
    if (colors.get(key) === 2) return;
    colors.set(key, 1);
    for (const child of adjacency.get(key) ?? []) visitForCycle(child);
    colors.set(key, 2);
  };
  for (const key of entityKeys) visitForCycle(key);

  const reachable = new Set();
  const stack = indegree.has(rootKey) ? [rootKey] : [];
  while (stack.length) {
    const key = stack.pop();
    if (reachable.has(key)) continue;
    reachable.add(key);
    stack.push(...(adjacency.get(key) ?? []));
  }
  for (const key of entityKeys) {
    if (!reachable.has(key)) errors.push(`unreachable structural entity ${key}`);
  }

  const nodeScopes = new Map();
  const scopeTraversal = new Set();
  const assignNodeScope = (templateNodeId, scope) => {
    const key = `${templateNodeId}:${scope ?? "page"}`;
    if (scopeTraversal.has(key)) return;
    scopeTraversal.add(key);
    if (nodeScopes.has(templateNodeId) && nodeScopes.get(templateNodeId) !== scope) {
      errors.push(`ambiguous node scope ${templateNodeId}`);
      return;
    }
    nodeScopes.set(templateNodeId, scope);
    const node = nodeMap.get(templateNodeId);
    if (!node) return;
    for (const child of node.children) {
      if (child.kind === "node") assignNodeScope(child.templateNodeId, scope);
      if (child.kind === "block") {
        const block = blockMap.get(child.templateBlockId);
        if (block) assignNodeScope(block.templateRootNodeId, block.templateBlockId);
      }
    }
  };
  if (nodeMap.has(pageIr.rootTemplateNodeId)) assignNodeScope(pageIr.rootTemplateNodeId, null);

  const declaredScope = (scope, label) => {
    if (scope.kind === "page") return null;
    if (!blockIds.has(scope.templateBlockId)) errors.push(`missing ${label} scope block`);
    return scope.templateBlockId;
  };
  for (const binding of pageIr.bindings) {
    if (!nodeIds.has(binding.target.templateNodeId)) errors.push("missing binding target");
    const scope = declaredScope(binding.scope, "binding");
    if (nodeScopes.get(binding.target.templateNodeId) !== scope) errors.push(`binding scope mismatch ${binding.templateBindingId}`);
  }
  for (const handler of pageIr.handlers) {
    if (!nodeIds.has(handler.templateNodeId)) errors.push("missing handler target");
    const scope = declaredScope(handler.scope, "handler");
    if (nodeScopes.get(handler.templateNodeId) !== scope) errors.push(`handler scope mismatch ${handler.templateHandlerId}`);
  }
  return errors;
}

function validateArtifactRelationships(set) {
  const errors = [];
  const { manifest, runtimeMetadata, pageIrsByPath, bootstrapsByPath } = set;
  if (runtimeMetadata.packageId !== manifest.package) errors.push("packageId mismatch");
  if (runtimeMetadata.entryRoute !== `/${manifest.router.entry}`) errors.push("entryRoute mismatch");
  const unique = (values, label) => {
    if (new Set(values).size !== values.length) errors.push(`duplicate ${label}`);
  };
  unique(runtimeMetadata.pages.map((page) => page.route), "route");
  unique(runtimeMetadata.pages.map((page) => page.manifestRoute), "manifest route");
  unique(runtimeMetadata.pages.map((page) => page.templateId), "templateId");
  const allModules = [runtimeMetadata.app, ...runtimeMetadata.sharedModules, ...runtimeMetadata.pages];
  unique(allModules.map((module) => module.moduleId), "moduleId");
  const artifactPaths = [
    runtimeMetadata.app.bundle.path,
    ...runtimeMetadata.sharedModules.map((module) => module.bundle.path),
    ...runtimeMetadata.pages.flatMap((page) => [page.bundle.path, page.pageIr.path]),
    ...runtimeMetadata.resources.map((resource) => resource.path)
  ];
  unique(artifactPaths, "artifact path");

  const manifestRoutes = Object.keys(manifest.router.pages);
  const metadataRoutes = new Set(runtimeMetadata.pages.map((page) => page.manifestRoute));
  for (const route of manifestRoutes) {
    if (!metadataRoutes.has(route)) errors.push(`missing metadata route ${route}`);
  }
  if (!manifest.router.pages[manifest.router.entry]) errors.push("manifest entry missing from pages");

  const sharedModuleIds = new Set(
    runtimeMetadata.sharedModules.map((module) => module.moduleId)
  );
  const allowedPageDependencies = new Set([
    runtimeMetadata.app.moduleId,
    ...sharedModuleIds
  ]);
  for (const dependency of runtimeMetadata.app.dependencies) {
    if (!sharedModuleIds.has(dependency)) errors.push(`invalid app dependency ${dependency}`);
  }
  const sharedById = new Map(
    runtimeMetadata.sharedModules.map((module) => [module.moduleId, module])
  );
  for (const module of runtimeMetadata.sharedModules) {
    for (const dependency of module.dependencies) {
      if (!sharedModuleIds.has(dependency) || dependency === module.moduleId) {
        errors.push(`invalid shared dependency ${module.moduleId} -> ${dependency}`);
      }
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visitShared = (moduleId) => {
    if (visiting.has(moduleId)) {
      errors.push(`shared dependency cycle ${moduleId}`);
      return;
    }
    if (visited.has(moduleId)) return;
    visiting.add(moduleId);
    for (const dependency of sharedById.get(moduleId)?.dependencies ?? []) {
      if (sharedById.has(dependency)) visitShared(dependency);
    }
    visiting.delete(moduleId);
    visited.add(moduleId);
  };
  for (const moduleId of sharedModuleIds) visitShared(moduleId);
  const appBootstrap = bootstrapsByPath[runtimeMetadata.app.bundle.path];
  if (!appBootstrap) errors.push(`missing app bootstrap ${runtimeMetadata.app.bundle.path}`);
  else if (appBootstrap.kind !== "app" || appBootstrap.moduleId !== runtimeMetadata.app.moduleId) errors.push("app bootstrap mismatch");

  for (const page of runtimeMetadata.pages) {
    const manifestPage = manifest.router.pages[page.manifestRoute];
    if (!manifestPage) errors.push(`missing manifest route ${page.manifestRoute}`);
    if (page.route !== `/${page.manifestRoute}`) errors.push(`route mismatch ${page.route}`);
    if (manifestPage && manifestPage.component !== page.component) errors.push(`component mismatch ${page.route}`);
    const pageIr = pageIrsByPath[page.pageIr.path];
    const bootstrap = bootstrapsByPath[page.bundle.path];
    if (!pageIr) errors.push(`missing Page IR ${page.pageIr.path}`);
    if (!bootstrap) errors.push(`missing bootstrap ${page.bundle.path}`);
    if (pageIr && pageIr.templateId !== page.templateId) errors.push(`Page IR template mismatch ${page.route}`);
    if (bootstrap && (bootstrap.moduleId !== page.moduleId || bootstrap.templateId !== page.templateId)) {
      errors.push(`bootstrap mismatch ${page.route}`);
    }
    for (const dependency of page.dependencies) {
      if (!allowedPageDependencies.has(dependency)) errors.push(`invalid page dependency ${dependency}`);
    }
    if (pageIr) errors.push(...validatePageIrSemantics(pageIr));
  }

  const expectedPageIrPaths = new Set(runtimeMetadata.pages.map((page) => page.pageIr.path));
  for (const path of Object.keys(pageIrsByPath)) {
    if (!expectedPageIrPaths.has(path)) errors.push(`unindexed Page IR ${path}`);
  }
  const expectedBootstrapPaths = new Set([
    runtimeMetadata.app.bundle.path,
    ...runtimeMetadata.pages.map((page) => page.bundle.path)
  ]);
  for (const path of Object.keys(bootstrapsByPath)) {
    if (!expectedBootstrapPaths.has(path)) errors.push(`unindexed bootstrap ${path}`);
  }
  return errors;
}

function buildNodeScopeMap(pageIr) {
  const nodeMap = new Map(pageIr.nodes.map((node) => [node.templateNodeId, node]));
  const blockDefinitions = new Map(pageIr.blocks.map((block) => [block.templateBlockId, block]));
  const nodeScopes = new Map();
  const assignNodeScope = (templateNodeId, scope) => {
    if (nodeScopes.has(templateNodeId)) return;
    nodeScopes.set(templateNodeId, scope);
    const node = nodeMap.get(templateNodeId);
    for (const child of node?.children ?? []) {
      if (child.kind === "node") assignNodeScope(child.templateNodeId, scope);
      if (child.kind === "block") {
        const definition = blockDefinitions.get(child.templateBlockId);
        if (definition) assignNodeScope(definition.templateRootNodeId, definition.templateBlockId);
      }
    }
  };
  assignNodeScope(pageIr.rootTemplateNodeId, null);
  return nodeScopes;
}

function validateInstantiateSemantics(message, pageIr) {
  const errors = [];
  if (message.templateId !== pageIr.templateId) errors.push("TEMPLATE_NOT_FOUND");
  const pageBindingIds = new Set(
    pageIr.bindings
      .filter((binding) => binding.scope.kind === "page")
      .map((binding) => binding.templateBindingId)
  );
  const pageHandlerIds = new Set(
    pageIr.handlers
      .filter((handler) => handler.scope.kind === "page")
      .map((handler) => handler.templateHandlerId)
  );
  const blockDefinitions = new Map(pageIr.blocks.map((block) => [block.templateBlockId, block]));
  const blockBindingIds = new Map(pageIr.blocks.map((block) => [
    block.templateBlockId,
    new Set(pageIr.bindings
      .filter((binding) => binding.scope.kind === "block" && binding.scope.templateBlockId === block.templateBlockId)
      .map((binding) => binding.templateBindingId))
  ]));
  const blockHandlerIds = new Map(pageIr.blocks.map((block) => [
    block.templateBlockId,
    new Set(pageIr.handlers
      .filter((handler) => handler.scope.kind === "block" && handler.scope.templateBlockId === block.templateBlockId)
      .map((handler) => handler.templateHandlerId))
  ]));
  const nodeScopes = buildNodeScopeMap(pageIr);
  const liveBlockOwners = new Map();

  const validateParent = (parent, definition) => {
    if (parent.templateNodeId !== definition.parentTemplateNodeId) return "ABI_INVALID_ARGUMENT";
    const parentScope = nodeScopes.get(definition.parentTemplateNodeId);
    if (parent.ownerInstanceId.startsWith("cmp:")) {
      if (parent.ownerInstanceId !== message.ownerInstanceId) return "TARGET_NOT_FOUND";
      return parentScope === null ? null : "ABI_INVALID_ARGUMENT";
    }
    if (!liveBlockOwners.has(parent.ownerInstanceId)) return "BLOCK_NOT_FOUND";
    return liveBlockOwners.get(parent.ownerInstanceId) === parentScope ? null : "ABI_INVALID_ARGUMENT";
  };

  for (const id of Object.keys(message.initialBindings).map(Number)) {
    if (!pageBindingIds.has(id)) errors.push(`initial Page Binding scope mismatch ${id}`);
  }
  for (const handler of message.initialHandlers) {
    if (handler.ownerInstanceId !== message.ownerInstanceId) errors.push(`initial Page Handler owner mismatch ${handler.handlerId}`);
    if (!pageHandlerIds.has(handler.templateHandlerId)) errors.push(`initial Page Handler scope mismatch ${handler.templateHandlerId}`);
  }
  for (const block of message.initialBlocks) {
    const definition = blockDefinitions.get(block.templateBlockId);
    if (!definition) {
      errors.push(`missing TemplateBlockId ${block.templateBlockId}`);
    } else {
      const parentError = validateParent(block.parent, definition);
      if (parentError) errors.push(parentError);
    }
    for (const id of Object.keys(block.initialBindings).map(Number)) {
      if (!blockBindingIds.get(block.templateBlockId)?.has(id)) errors.push(`initial Block Binding scope mismatch ${id}`);
    }
    for (const handler of block.handlers) {
      if (handler.ownerInstanceId !== block.blockInstanceId) errors.push(`initial Block Handler owner mismatch ${handler.handlerId}`);
      if (!blockHandlerIds.get(block.templateBlockId)?.has(handler.templateHandlerId)) {
        errors.push(`initial Block Handler scope mismatch ${handler.templateHandlerId}`);
      }
    }
    liveBlockOwners.set(block.blockInstanceId, block.templateBlockId);
  }
  return errors;
}

function validateRenderAddressing(message, pageIr, runtimeState) {
  const errors = [];
  const bindingById = new Map(pageIr.bindings.map((binding) => [binding.templateBindingId, binding]));
  const blockById = new Map(pageIr.blocks.map((block) => [block.templateBlockId, block]));
  const liveBlocks = new Map(runtimeState.liveBlocks.map((block) => [block.ownerInstanceId, block.templateBlockId]));
  const nodeScopes = buildNodeScopeMap(pageIr);

  const validateOwner = (ownerInstanceId, definitionScope) => {
    if (ownerInstanceId.startsWith("cmp:")) {
      if (ownerInstanceId !== runtimeState.pageOwnerInstanceId) return "TARGET_NOT_FOUND";
      return definitionScope.kind === "page" ? null : "ABI_INVALID_ARGUMENT";
    }
    if (!liveBlocks.has(ownerInstanceId)) return "BLOCK_NOT_FOUND";
    return definitionScope.kind === "block" && liveBlocks.get(ownerInstanceId) === definitionScope.templateBlockId
      ? null
      : "ABI_INVALID_ARGUMENT";
  };

  for (const operation of message.operations) {
    if (operation.kind === "updateBinding") {
      const definition = bindingById.get(operation.templateBindingId);
      if (!definition) errors.push("TEMPLATE_NOT_FOUND");
      else {
        const error = validateOwner(operation.ownerInstanceId, definition.scope);
        if (error) errors.push(error);
      }
    }
    if (operation.kind === "instantiateBlock") {
      const definition = blockById.get(operation.templateBlockId);
      if (!definition) {
        errors.push("TEMPLATE_NOT_FOUND");
      } else {
        if (operation.parent.templateNodeId !== definition.parentTemplateNodeId) errors.push("ABI_INVALID_ARGUMENT");
        const parentTemplateScope = nodeScopes.get(definition.parentTemplateNodeId);
        const parentScope = parentTemplateScope === null
          ? { kind: "page" }
          : { kind: "block", templateBlockId: parentTemplateScope };
        const parentError = validateOwner(operation.parent.ownerInstanceId, parentScope);
        if (parentError) errors.push(parentError);
      }
      for (const handler of operation.handlers) {
        if (handler.ownerInstanceId !== operation.blockInstanceId) errors.push("ABI_INVALID_ARGUMENT");
      }
      liveBlocks.set(operation.blockInstanceId, operation.templateBlockId);
    }
    if (operation.kind === "moveBlock" || operation.kind === "removeBlock") {
      if (!liveBlocks.has(operation.blockInstanceId)) errors.push("BLOCK_NOT_FOUND");
    }
  }
  return errors;
}

function validateRegisterHandlerSemantics(message, pageIr, runtimeState) {
  const definition = pageIr.handlers.find((handler) => handler.templateHandlerId === message.templateHandlerId);
  if (!definition) return ["TEMPLATE_NOT_FOUND"];
  if (message.ownerInstanceId.startsWith("cmp:")) {
    if (message.ownerInstanceId !== runtimeState.pageOwnerInstanceId) return ["TARGET_NOT_FOUND"];
    return definition.scope.kind === "page" ? [] : ["ABI_INVALID_ARGUMENT"];
  }
  const liveBlock = runtimeState.liveBlocks.find((block) => block.ownerInstanceId === message.ownerInstanceId);
  if (!liveBlock) return ["BLOCK_NOT_FOUND"];
  return definition.scope.kind === "block" && definition.scope.templateBlockId === liveBlock.templateBlockId
    ? []
    : ["ABI_INVALID_ARGUMENT"];
}

const artifactErrors = validateArtifactRelationships(artifactSet);
if (artifactErrors.length) {
  throw new Error(`Valid Artifact set rejected: ${artifactErrors.join(", ")}`);
}

const instantiateFixture = branchFixtures["https://quickapp-kit.dev/v1/runtime-abi.schema.json"];
const instantiateErrors = validateInstantiateSemantics(instantiateFixture.instantiateTemplate, artifactSet.pageIrsByPath[artifactSet.runtimeMetadata.pages[0].pageIr.path]);
if (instantiateErrors.length) {
  throw new Error(`Valid InstantiateTemplate rejected: ${instantiateErrors.join(", ")}`);
}

const instantiateSemanticNegatives = [
  ["templateId", (value) => { value.templateId = "pages/Other:index"; }, "TEMPLATE_NOT_FOUND"],
  ["Page Handler owner", (value) => { value.initialHandlers[0].ownerInstanceId = "cmp:other"; }, "initial Page Handler owner mismatch"],
  ["Page Binding scope", (value) => { value.initialBindings = { "2": "wrong" }; }, "initial Page Binding scope mismatch 2"],
  ["missing TemplateBlockId", (value) => { value.initialBlocks[0].templateBlockId = 99; }, "missing TemplateBlockId 99"],
  ["Block Binding scope", (value) => { value.initialBlocks[0].initialBindings = { "1": "wrong" }; }, "initial Block Binding scope mismatch 1"],
  ["Block Handler owner", (value) => { value.initialBlocks[0].handlers = [{ ownerInstanceId: "blk:other", templateHandlerId: 1, handlerId: "hdl:block" }]; }, "initial Block Handler owner mismatch"],
  ["Block Handler scope", (value) => { value.initialBlocks[0].handlers = [{ ownerInstanceId: "blk:item-a", templateHandlerId: 1, handlerId: "hdl:block" }]; }, "initial Block Handler scope mismatch 1"],
  ["wrong parent TemplateNodeId", (value) => { value.initialBlocks[0].parent.templateNodeId = 2; }, "ABI_INVALID_ARGUMENT"],
  ["stale Page parent", (value) => { value.initialBlocks[0].parent.ownerInstanceId = "cmp:stale"; }, "TARGET_NOT_FOUND"],
  ["stale Block parent", (value) => { value.initialBlocks[0].parent.ownerInstanceId = "blk:stale"; }, "BLOCK_NOT_FOUND"]
];
for (const [label, mutate, expectedError] of instantiateSemanticNegatives) {
  const invalid = structuredClone(instantiateFixture.instantiateTemplate);
  mutate(invalid);
  if (!validateInstantiateSemantics(invalid, artifactSet.pageIrsByPath[artifactSet.runtimeMetadata.pages[0].pageIr.path]).some((error) => error.includes(expectedError))) {
    throw new Error(`InstantiateTemplate semantic negative not rejected: ${label}`);
  }
}

const renderFixture = schemaFixtures["https://quickapp-kit.dev/v1/render-transaction.schema.json"];
const renderRuntimeState = {
  pageOwnerInstanceId: "cmp:page",
  liveBlocks: [
    { ownerInstanceId: "blk:item-a", templateBlockId: 1 },
    { ownerInstanceId: "blk:item-c", templateBlockId: 1 }
  ]
};
const renderErrors = validateRenderAddressing(renderFixture, artifactSet.pageIrsByPath[artifactSet.runtimeMetadata.pages[0].pageIr.path], renderRuntimeState);
if (renderErrors.length) {
  throw new Error(`Valid RenderTransaction addressing rejected: ${renderErrors.join(", ")}`);
}

const renderAddressingNegatives = [
  ["missing TemplateBindingId", (value) => { value.operations[0].templateBindingId = 99; }, "TEMPLATE_NOT_FOUND"],
  ["stale Page owner", (value) => { value.operations[0].ownerInstanceId = "cmp:stale"; }, "TARGET_NOT_FOUND"],
  ["stale Block owner", (value) => { value.operations[1].ownerInstanceId = "blk:stale"; }, "BLOCK_NOT_FOUND"],
  ["Page owner with Block Binding", (value) => { value.operations[1].ownerInstanceId = "cmp:page"; }, "ABI_INVALID_ARGUMENT"],
  ["Block owner with Page Binding", (value) => { value.operations[0].ownerInstanceId = "blk:item-a"; }, "ABI_INVALID_ARGUMENT"],
  ["Block template mismatch", (value, state) => { state.liveBlocks[0].templateBlockId = 99; }, "ABI_INVALID_ARGUMENT"],
  ["missing TemplateBlockId", (value) => { value.operations[2].templateBlockId = 99; }, "TEMPLATE_NOT_FOUND"],
  ["wrong Block parent TemplateNodeId", (value) => { value.operations[2].parent.templateNodeId = 2; }, "ABI_INVALID_ARGUMENT"],
  ["stale Block parent owner", (value) => { value.operations[2].parent.ownerInstanceId = "blk:stale"; }, "BLOCK_NOT_FOUND"],
  ["stale RemoveBlock", (value) => { value.operations.at(-1).blockInstanceId = "blk:stale"; }, "BLOCK_NOT_FOUND"]
];
for (const [label, mutate, expectedError] of renderAddressingNegatives) {
  const invalid = structuredClone(renderFixture);
  const state = structuredClone(renderRuntimeState);
  mutate(invalid, state);
  if (!validateRenderAddressing(invalid, artifactSet.pageIrsByPath[artifactSet.runtimeMetadata.pages[0].pageIr.path], state).includes(expectedError)) {
    throw new Error(`RenderTransaction addressing negative not rejected: ${label}`);
  }
}

const registerHandlerFixture = instantiateFixture.registerHandler;
const registerHandlerErrors = validateRegisterHandlerSemantics(
  registerHandlerFixture,
  artifactSet.pageIrsByPath[artifactSet.runtimeMetadata.pages[0].pageIr.path],
  renderRuntimeState
);
if (registerHandlerErrors.length) {
  throw new Error(`Valid RegisterHandler addressing rejected: ${registerHandlerErrors.join(", ")}`);
}

const registerHandlerNegatives = [
  ["missing TemplateHandlerId", (value) => { value.templateHandlerId = 99; }, () => {}, "TEMPLATE_NOT_FOUND"],
  ["stale Page owner", (value) => { value.ownerInstanceId = "cmp:stale"; }, () => {}, "TARGET_NOT_FOUND"],
  ["stale Block owner", (value) => { value.ownerInstanceId = "blk:stale"; value.templateHandlerId = 2; }, (ir) => ir.handlers.push({ templateHandlerId: 2, scope: { kind: "block", templateBlockId: 1 }, templateNodeId: 5, eventType: "click" }), "BLOCK_NOT_FOUND"],
  ["Page owner with Block Handler", (value) => { value.templateHandlerId = 2; }, (ir) => ir.handlers.push({ templateHandlerId: 2, scope: { kind: "block", templateBlockId: 1 }, templateNodeId: 5, eventType: "click" }), "ABI_INVALID_ARGUMENT"],
  ["Block owner with Page Handler", (value) => { value.ownerInstanceId = "blk:item-a"; }, () => {}, "ABI_INVALID_ARGUMENT"],
  ["Block template scope mismatch", (value) => { value.ownerInstanceId = "blk:item-a"; value.templateHandlerId = 2; }, (ir) => ir.handlers.push({ templateHandlerId: 2, scope: { kind: "block", templateBlockId: 2 }, templateNodeId: 5, eventType: "click" }), "ABI_INVALID_ARGUMENT"]
];
for (const [label, mutateMessage, mutatePageIr, expectedError] of registerHandlerNegatives) {
  const invalid = structuredClone(registerHandlerFixture);
  const testPageIr = structuredClone(artifactSet.pageIrsByPath[artifactSet.runtimeMetadata.pages[0].pageIr.path]);
  mutateMessage(invalid);
  mutatePageIr(testPageIr);
  if (!validateRegisterHandlerSemantics(invalid, testPageIr, renderRuntimeState).includes(expectedError)) {
    throw new Error(`RegisterHandler addressing negative not rejected: ${label}`);
  }
}

const pageIrSemanticNegatives = [
  ["node cycle", (value) => value.nodes.find((node) => node.templateNodeId === 5).children.push({ kind: "node", templateNodeId: 4 }), "structural cycle"],
  ["root has a parent", (value) => value.nodes.find((node) => node.templateNodeId === 2).children.push({ kind: "node", templateNodeId: 1 }), "root indegree must be zero"],
  ["Block root points to ancestor", (value) => { value.blocks[0].templateRootNodeId = 1; }, "structural cycle"],
  ["multiple parents", (value) => value.nodes.find((node) => node.templateNodeId === 3).children.push({ kind: "node", templateNodeId: 2 }), "invalid structural indegree node:2"],
  ["shared Block root", (value) => value.nodes[0].children.push({ kind: "node", templateNodeId: 4 }), "invalid structural indegree node:4"],
  ["wrong Block parent", (value) => { value.blocks[0].parentTemplateNodeId = 2; }, "block parent slot mismatch 1"],
  ["binding scope", (value) => { value.bindings[1].scope = { kind: "page" }; }, "binding scope mismatch 2"],
  ["handler scope", (value) => { value.handlers[0].scope = { kind: "block", templateBlockId: 1 }; }, "handler scope mismatch 1"]
];
for (const [label, mutate, expectedError] of pageIrSemanticNegatives) {
  const invalid = structuredClone(artifactSet.pageIrsByPath[artifactSet.runtimeMetadata.pages[0].pageIr.path]);
  mutate(invalid);
  if (!validatePageIrSemantics(invalid).some((error) => error.includes(expectedError))) {
    throw new Error(`Page IR semantic negative not rejected: ${label}`);
  }
}

const artifactRelationshipNegatives = [
  ["page bootstrap", (set) => { set.bootstrapsByPath["pages/Demo/index.js"].templateId = "pages/Other:index"; }, "bootstrap mismatch /pages/Demo"],
  ["Manifest page without Metadata page", (set) => { set.manifest.router.pages["pages/Extra"] = { component: "index" }; }, "missing metadata route pages/Extra"],
  ["Metadata page without Manifest page", (set) => { delete set.manifest.router.pages["pages/Demo"]; }, "missing manifest route pages/Demo"],
  ["global moduleId", (set) => { set.runtimeMetadata.pages[0].moduleId = set.runtimeMetadata.app.moduleId; }, "duplicate moduleId"],
  ["app dependency", (set) => { set.runtimeMetadata.app.dependencies = ["@unknown/module"]; }, "invalid app dependency @unknown/module"],
  ["shared self dependency", (set) => {
    set.runtimeMetadata.sharedModules = [{
      moduleId: "@quickapp-kit/shared/a",
      dependencies: ["@quickapp-kit/shared/a"],
      bundle: { path: "shared/a.js", mediaType: "application/javascript", byteLength: 1, sha256: "a".repeat(64) }
    }];
  }, "invalid shared dependency @quickapp-kit/shared/a -> @quickapp-kit/shared/a"],
  ["page dependency", (set) => { set.runtimeMetadata.pages[0].dependencies = ["@unknown/module"]; }, "invalid page dependency @unknown/module"],
  ["app bootstrap", (set) => { set.bootstrapsByPath["app.js"].moduleId = "@other/app"; }, "app bootstrap mismatch"],
  ["global templateId", (set) => {
    set.manifest.router.pages["pages/Detail"] = { component: "index" };
    const detail = structuredClone(set.runtimeMetadata.pages[0]);
    detail.route = "/pages/Detail";
    detail.manifestRoute = "pages/Detail";
    detail.moduleId = "@quickapp-kit/page/pages/Detail";
    detail.bundle.path = "pages/Detail/index.js";
    detail.pageIr.path = "quickapp-kit/pages/Detail/index.ir.json";
    set.runtimeMetadata.pages.push(detail);
    set.pageIrsByPath[detail.pageIr.path] = structuredClone(set.pageIrsByPath["quickapp-kit/pages/Demo/index.ir.json"]);
    set.bootstrapsByPath[detail.bundle.path] = { schemaVersion: 1, kind: "page", moduleId: detail.moduleId, templateId: detail.templateId };
  }, "duplicate templateId"],
  ["artifact path", (set) => { set.runtimeMetadata.resources[0].path = set.runtimeMetadata.app.bundle.path; }, "duplicate artifact path"]
];
for (const [label, mutate, expectedError] of artifactRelationshipNegatives) {
  const invalid = structuredClone(artifactSet);
  mutate(invalid);
  if (!validateArtifactRelationships(invalid).some((error) => error.includes(expectedError))) {
    throw new Error(`Artifact relationship negative not rejected: ${label}`);
  }
}

const signaturePath = "META-INF/QUICKAPP-KIT.SIG";
const u16 = (value) => {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16BE(value);
  return bytes;
};
const u32 = (value) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
};
const u64 = (value) => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return bytes;
};

function validatePackageMembers(entries) {
  const paths = new Set();
  for (const entry of entries) {
    if (paths.has(entry.path)) return "PACKAGE_ENTRY_INVALID";
    paths.add(entry.path);
    if (!entry.path || entry.path.startsWith("/") || entry.path.includes("\\") || entry.path.includes("\0")) return "PACKAGE_ENTRY_INVALID";
    if (entry.path.split("/").includes("..")) return "PACKAGE_ENTRY_INVALID";
    if (Buffer.from(entry.path, "utf8").toString("utf8") !== entry.path) return "PACKAGE_ENTRY_INVALID";
  }
  return null;
}

function buildSignaturePayload(entries, keyId) {
  const members = entries
    .filter((entry) => !entry.directory && entry.path !== signaturePath)
    .sort((left, right) => Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8")));
  const keyIdBytes = Buffer.from(keyId, "utf8");
  const chunks = [
    Buffer.from("QAK-RPK-SIGNED-CONTENT-V1\0", "ascii"),
    u16(keyIdBytes.length),
    keyIdBytes,
    u32(members.length)
  ];
  for (const member of members) {
    const pathBytes = Buffer.from(member.path, "utf8");
    chunks.push(
      u32(pathBytes.length),
      pathBytes,
      u64(member.bytes.length),
      createHash("sha256").update(member.bytes).digest()
    );
  }
  return Buffer.concat(chunks);
}

function buildSignatureFile(keyId, signature) {
  const keyIdBytes = Buffer.from(keyId, "utf8");
  return Buffer.concat([
    Buffer.from("QAKSIGV1", "ascii"),
    Buffer.from([1, 1]),
    u16(keyIdBytes.length),
    keyIdBytes,
    signature
  ]);
}

function parseSignatureFile(bytes) {
  if (bytes.length < 12 + 1 + 64) throw new Error("short signature");
  if (!bytes.subarray(0, 8).equals(Buffer.from("QAKSIGV1", "ascii"))) throw new Error("signature magic");
  if (bytes[8] !== 1 || bytes[9] !== 1) throw new Error("signature version or algorithm");
  const keyIdLength = bytes.readUInt16BE(10);
  if (keyIdLength < 1 || keyIdLength > 64 || bytes.length !== 12 + keyIdLength + 64) throw new Error("signature length");
  const keyId = bytes.subarray(12, 12 + keyIdLength).toString("utf8");
  if (!/^[A-Za-z0-9._-]+$/.test(keyId)) throw new Error("signature keyId");
  return { keyId, signature: bytes.subarray(12 + keyIdLength) };
}

function validatePolicySemantics(policy) {
  const ids = policy.trustedKeys.map((key) => key.keyId);
  return new Set(ids).size === ids.length ? [] : ["duplicate trusted keyId"];
}

function verifyPackageSignature(entries, policy) {
  const memberError = validatePackageMembers(entries);
  if (memberError) return memberError;
  if (validatePolicySemantics(policy).length) return "PACKAGE_INVALID";
  const signatureEntry = entries.find((entry) => entry.path === signaturePath);
  if (!signatureEntry) {
    return policy.verificationMode === "release" || !policy.allowUnsigned
      ? "PACKAGE_SIGNATURE_REQUIRED"
      : null;
  }
  let parsed;
  try {
    parsed = parseSignatureFile(signatureEntry.bytes);
  } catch {
    return "PACKAGE_SIGNATURE_INVALID";
  }
  const trustedKey = policy.trustedKeys.find((key) => key.keyId === parsed.keyId);
  if (!trustedKey) return "PACKAGE_SIGNER_UNTRUSTED";
  const rawPublicKey = Buffer.from(trustedKey.publicKey, "base64url");
  if (rawPublicKey.length !== 32) return "PACKAGE_SIGNATURE_INVALID";
  const publicKey = createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), rawPublicKey]),
    format: "der",
    type: "spki"
  });
  const payload = buildSignaturePayload(entries, parsed.keyId);
  return verify(null, payload, publicKey, parsed.signature) ? null : "PACKAGE_SIGNATURE_INVALID";
}

const goldenMembers = signatureGolden.members.map((entry) => ({
  path: entry.path,
  bytes: Buffer.from(entry.content, "utf8")
}));
const seed = Buffer.from(signatureGolden.privateKeySeedHex, "hex");
const privateKey = createPrivateKey({
  key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]),
  format: "der",
  type: "pkcs8"
});
const payload = buildSignaturePayload(goldenMembers, signatureGolden.keyId);
if (createHash("sha256").update(payload).digest("hex") !== signatureGolden.expectedPayloadSha256) {
  throw new Error("Signature canonical payload Golden mismatch");
}
const goldenSignature = sign(null, payload, privateKey);
if (goldenSignature.toString("base64url") !== signatureGolden.expectedSignatureBase64url) {
  throw new Error("Ed25519 signature Golden mismatch");
}
const signedGolden = [
  ...goldenMembers,
  { path: signaturePath, bytes: buildSignatureFile(signatureGolden.keyId, goldenSignature) }
];
const releasePolicy = {
  schemaVersion: 1,
  verificationMode: "release",
  allowUnsigned: false,
  trustedKeys: [{
    keyId: signatureGolden.keyId,
    algorithm: "Ed25519",
    publicKey: signatureGolden.publicKeyBase64url
  }]
};
const developmentPolicy = {
  schemaVersion: 1,
  verificationMode: "development",
  allowUnsigned: true,
  trustedKeys: []
};
const developmentTrustedPolicy = {
  ...releasePolicy,
  verificationMode: "development",
  allowUnsigned: true
};
const signatureCases = [
  ["valid release", signedGolden, releasePolicy, null],
  ["unsigned release", goldenMembers, releasePolicy, "PACKAGE_SIGNATURE_REQUIRED"],
  ["unsigned development", goldenMembers, developmentPolicy, null],
  ["tampered member", signedGolden.map((entry) => entry.path === "app.js" ? { ...entry, bytes: Buffer.from("tampered") } : entry), releasePolicy, "PACKAGE_SIGNATURE_INVALID"],
  ["tampered signed development", signedGolden.map((entry) => entry.path === "app.js" ? { ...entry, bytes: Buffer.from("tampered") } : entry), developmentTrustedPolicy, "PACKAGE_SIGNATURE_INVALID"],
  ["added member", [...signedGolden, { path: "extra.txt", bytes: Buffer.from("extra") }], releasePolicy, "PACKAGE_SIGNATURE_INVALID"],
  ["duplicate member", [...signedGolden, { path: "app.js", bytes: Buffer.from("duplicate") }], releasePolicy, "PACKAGE_ENTRY_INVALID"],
  ["unknown signer", signedGolden, { ...releasePolicy, trustedKeys: [{ ...releasePolicy.trustedKeys[0], keyId: "other-key" }] }, "PACKAGE_SIGNER_UNTRUSTED"],
  ["duplicate trusted keyId", signedGolden, { ...releasePolicy, trustedKeys: [releasePolicy.trustedKeys[0], releasePolicy.trustedKeys[0]] }, "PACKAGE_INVALID"],
  ["malformed signature", signedGolden.map((entry) => entry.path === signaturePath ? { ...entry, bytes: Buffer.from("bad") } : entry), releasePolicy, "PACKAGE_SIGNATURE_INVALID"]
];
for (const [label, entries, policy, expected] of signatureCases) {
  const actual = verifyPackageSignature(entries, policy);
  if (actual !== expected) throw new Error(`Signature case ${label}: expected ${expected}, got ${actual}`);
}

console.log(
  `Validated ${catalog.schemas.length} schemas, ${branchCount} union branches, ` +
  `${supplementalPositiveFixtures.length} supplemental positives, ` +
  `${runtimeCompositionSemanticNegatives.length} Runtime composition semantic checks, ` +
  `${pageIrSemanticNegatives.length} Page IR graph negatives, ` +
  `${instantiateSemanticNegatives.length} InstantiateTemplate semantic negatives, ` +
  `${renderAddressingNegatives.length} Render addressing negatives, ` +
  `${registerHandlerNegatives.length} RegisterHandler addressing negatives, ` +
  `${artifactRelationshipNegatives.length} Artifact relation negatives, and ` +
  `${signatureCases.length} signature cases.`
);
