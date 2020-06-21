const test1 = () => {
  console.log(1);
  throw new Error(2);
  console.log(3);
}

const test2 = () => {
  try {
    console.log(21);
    throw new Error(22);
  } catch(e) {
    console.log(22);
    return; // 不会阻止finally, 但是会组织整个函数流程
  } finally {
    console.log(23);
    return;
  }
  console.log(24);
}

test2();

