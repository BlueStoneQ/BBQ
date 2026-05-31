## 六、设计模式



## 目录

- [6.1 单例模式](#61-单例模式)

---

### 6.1 单例模式

⭐⭐
**考点**：闭包、设计模式

**作用**：确保一个类只有一个实例

```javascript
const Singleton = (function() {
  let instance;

  function createInstance() {
    return {
      name: 'singleton',
      getName() {
        return this.name;
      }
    };
  }

  return {
    getInstance() {
      if (!instance) {
        instance = createInstance();
      }
      return instance;
    }
  };
})();

// 使用
const instance1 = Singleton.getInstance();
const instance2 = Singleton.getInstance();

console.log(instance1 === instance2); // true
```

**总结**：
- **核心思路**：使用闭包保存唯一实例，懒加载模式
- **关键点**：
  1. 使用闭包保存实例
  2. 懒加载：第一次调用时创建实例
  3. 后续调用返回同一实例

---

