import 'fake-indexeddb/auto';

// jsdom does not implement scrolling
Element.prototype.scrollTo = () => {};
