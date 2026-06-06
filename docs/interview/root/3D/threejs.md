# Three.js 核心概念与渲染管线

> 解决什么问题：在浏览器中渲染 3D 场景（WebGL 太底层，Three.js 封装了一层高级 API）。
> 本质：Scene + Camera + Renderer 三要素 → requestAnimationFrame 循环 → GPU 每帧绘制。
> 经验支撑：负载分析平台 3D 图表（Scene/Camera/Light/Controls/Geometry 全链路使用）。

---

## 目录

- [核心三要素](#核心三要素)
- [渲染管线](#渲染管线)
- [核心对象速查](#核心对象速查)
- [渲染循环](#渲染循环)
- [性能优化](#性能优化)
- [内存管理](#内存管理)
- [和前端框架集成（Vue/React）](#和前端框架集成vuereact)
- [WebGL / WebGPU 认知](#webgl--webgpu-认知)
- [面试高频问题](#面试高频问题)

---

## 核心三要素

```
任何 Three.js 场景 = Scene + Camera + Renderer

Scene（场景）：3D 世界的容器，所有物体放在里面
Camera（相机）：观察视角，决定用户"看到什么"
Renderer（渲染器）：把场景+相机的画面绘制到 canvas

类比电影：
  Scene = 片场（布景、演员、灯光）
  Camera = 摄影机（角度、焦距）
  Renderer = 胶片/屏幕（最终呈现）
```

```ts
// 最小 Three.js 程序
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl });

// 添加物体
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// 添加光源
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
scene.add(new THREE.DirectionalLight(0xffffff, 1));

// 渲染
camera.position.z = 5;
renderer.render(scene, camera);
```

---

## 渲染管线

```
JS 层（Three.js）                    GPU 层（WebGL/WebGPU）
┌─────────────────┐                 ┌──────────────────┐
│ Scene Graph     │                 │ Vertex Shader    │
│ (对象树)        │ ─── 提交 ───→   │ (顶点变换)       │
│                 │   顶点/材质/    │       ↓          │
│ Camera 矩阵计算  │   纹理数据      │ Rasterization    │
│                 │                 │ (光栅化)         │
│ Frustum Culling │                 │       ↓          │
│ (视锥体裁剪)    │                 │ Fragment Shader  │
└─────────────────┘                 │ (像素着色)       │
                                    │       ↓          │
                                    │ Frame Buffer     │
                                    │ (输出到屏幕)     │
                                    └──────────────────┘

每帧 Three.js 做的事：
1. 遍历 Scene Graph，计算每个物体的世界矩阵
2. Camera 计算 View + Projection 矩阵
3. Frustum Culling：相机看不到的物体直接跳过
4. 按材质/透明度排序（减少 GPU 状态切换）
5. 提交 draw call 给 GPU
6. GPU 执行 shader → 输出像素
```

---

## 核心对象速查

| 对象 | 作用 | 关键参数 |
|------|------|---------|
| **Scene** | 3D 容器 | background, fog |
| **PerspectiveCamera** | 透视相机（近大远小） | fov, aspect, near, far |
| **OrthographicCamera** | 正交相机（无透视） | left, right, top, bottom |
| **WebGLRenderer** | 渲染到 canvas | antialias, pixelRatio |
| **Mesh** | 可见物体 = Geometry + Material | geometry, material |
| **BufferGeometry** | 顶点数据（位置/法线/UV） | attributes, index |
| **MeshStandardMaterial** | PBR 材质 | color, roughness, metalness, map |
| **DirectionalLight** | 平行光（太阳） | intensity, color, castShadow |
| **AmbientLight** | 环境光（均匀照亮） | intensity |
| **OrbitControls** | 鼠标旋转/缩放/平移 | enableDamping, target |
| **TextureLoader** | 加载贴图 | load(url, onLoad) |
| **GLTFLoader** | 加载 3D 模型文件 | load(url, onLoad) |

---

## 渲染循环

```ts
// 标准渲染循环
function animate() {
  requestAnimationFrame(animate);  // 每帧调用（~60fps）
  
  controls.update();               // 更新相机控制器
  cube.rotation.y += 0.01;         // 动画
  
  renderer.render(scene, camera);  // 渲染当前帧
}
animate();
```

**为什么用 requestAnimationFrame？**
- 和浏览器刷新率同步（通常 60fps）
- 标签页不可见时自动暂停（省电/CPU）
- 比 setInterval 更精确

---

## 性能优化

| 手段 | 原理 | 适用场景 |
|------|------|---------|
| **Instanced Mesh** | 同一几何体渲染多个实例（1 个 draw call） | 大量相同物体（粒子/树木） |
| **LOD** | 远处用低精度模型，近处用高精度 | 大型场景 |
| **Frustum Culling** | 相机视锥外的物体不渲染 | Three.js 默认开启 |
| **Geometry Merging** | 多个静态物体合并为一个 Mesh | 减少 draw call |
| **纹理压缩** | 用 KTX2/Basis 压缩纹理 | 减少 GPU 显存占用 |
| **按需渲染** | 只有场景变化时才 render（不用每帧都跑） | 静态展示场景 |
| **Web Worker** | 数据计算放 Worker | 不阻塞主线程 |
| **OffscreenCanvas** | 渲染放 Worker | 实验性，释放主线程 |

### 性能指标

```
关键指标：
  FPS（帧率）：稳定 60fps
  Draw Calls：越少越好（理想 < 100）
  Triangles：面片数（影响 GPU 负载）
  GPU Memory：纹理 + 几何体占用
  
调试工具：
  renderer.info → { render: { calls, triangles }, memory: { geometries, textures } }
  Chrome DevTools → Performance 面板看帧率
  Spector.js → WebGL 调用分析
```

---

## 内存管理

**Three.js 不会自动释放 GPU 资源！必须手动 dispose。**

```ts
// ❌ 只删引用，GPU 资源泄漏
scene.remove(mesh);

// ✅ 完整释放
scene.remove(mesh);
mesh.geometry.dispose();       // 释放顶点缓冲区
mesh.material.dispose();       // 释放材质
if (mesh.material.map) {
  mesh.material.map.dispose(); // 释放纹理
}
```

**常见泄漏场景**：
- 切换页面/路由后没有 dispose 旧场景
- 动态创建 Geometry/Material 没有清理
- Texture 加载了没释放

---

## 和前端框架集成（Vue/React）

**核心原则：不要让框架管 Three.js 的渲染循环。**

```
❌ 错误做法：
  把 Three.js 对象放在 reactive/state 里 → 每次属性变化触发组件重渲染 → 性能灾难

✅ 正确做法：
  Three.js 独立管自己的渲染循环（requestAnimationFrame）
  框架只管"控制面板"（UI 按钮/滑块）
  交互通过 ref 引用 Three.js 对象 → 直接修改属性（不走响应式）
```

```ts
// Vue 3 中正确使用 Three.js
const canvasRef = ref<HTMLCanvasElement>();
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;

onMounted(() => {
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value! });
  animate();
});

onUnmounted(() => {
  // 必须清理！
  renderer.dispose();
  scene.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  });
});

// UI 控制 → 直接操作 Three.js 对象，不走 reactive
function changeColor(color: string) {
  cube.material.color.set(color);  // 直接改，不触发 Vue 重渲染
}
```

---

## WebGL / WebGPU 认知

| | WebGL | WebGPU |
|---|---|---|
| 本质 | OpenGL ES 的 Web 封装 | 新一代图形 API（类 Vulkan/Metal） |
| 状态模型 | 全局状态机（容易出错） | 命令缓冲区（更现代） |
| 性能 | 好 | 更好（多线程提交、Compute Shader） |
| 支持 | 全浏览器 | Chrome 113+，Safari 18+ |
| Three.js | WebGLRenderer | WebGPURenderer（实验性） |

**面试时点到为止**：知道 WebGPU 是下一代，Three.js 已经有 WebGPURenderer 实验性支持，未来趋势是 WebGPU 替代 WebGL。

---

## 面试高频问题

| 问题 | 一句话答案 |
|------|-----------|
| Three.js 渲染一帧做了什么？ | 遍历场景图 → 计算矩阵 → 视锥裁剪 → 排序 → 提交 draw call → GPU 执行 shader |
| 怎么优化 Three.js 性能？ | 减少 draw call（合并/实例化）、LOD、纹理压缩、按需渲染 |
| 内存泄漏怎么处理？ | geometry/material/texture 必须手动 dispose，切换页面时清理 |
| 和 Vue/React 怎么配合？ | 框架管 UI，Three.js 独立渲染循环，通过 ref 直接操作 3D 对象 |
| WebGL 和 WebGPU 区别？ | WebGPU 更现代（命令缓冲区/compute shader），Three.js 已有实验性支持 |
| 什么是 draw call？ | CPU 向 GPU 发出一次绘制指令，每个 Mesh 通常 1 个 draw call |
| 什么是 shader？ | GPU 上运行的程序（Vertex Shader 变换顶点，Fragment Shader 计算像素颜色） |
