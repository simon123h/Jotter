import 'fake-indexeddb/auto';

// jsdom does not implement scrolling (and some tests run in plain node, without any DOM)
if (typeof Element !== 'undefined') Element.prototype.scrollTo = () => {};
