// Small renderer-only helpers. Labels always use textContent so card names and
// imported text cannot introduce markup. Specialized controls keep their own
// busy states, accessibility attributes and action/error handling.
export function el(tag, text, className) {
 const node = document.createElement(tag);
 if (text !== undefined) node.textContent = text;
 if (className) node.className = className;
 return node;
}

export function button(text, onClick, className) {
 const node = el('button', text, className);
 node.type = 'button';
 node.onclick = onClick;
 return node;
}

export function loadStyles(relativePath, moduleUrl) {
 const link = el('link');
 link.rel = 'stylesheet';
 link.href = new URL(relativePath, moduleUrl).href;
 document.head.append(link);
 return link;
}
