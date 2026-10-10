if (typeof window !== 'undefined') {
  Range.prototype.getClientRects = function () {
    return {
      item: () => null,
      length: 0,
      [Symbol.iterator]: function* () {},
    } as any;
  };

  Range.prototype.getBoundingClientRect = function () {
    return {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
  };
}
