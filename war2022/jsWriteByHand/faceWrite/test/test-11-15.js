function debounce(fn, delay = 300) {
  let timer = null;

  return function() {
    const context = this, args = Array.prototype.slice.call(arguments);

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    timer = setTimeout(function () {
      fn && fn.apply(context, args);
      timer = null;
    }, delay);
  }
}