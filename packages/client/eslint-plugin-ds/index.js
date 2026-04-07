/**
 * ESLint plugin to enforce design system component usage.
 * Bans raw HTML elements outside of components/ui/ directory.
 */

function createNoRawElementRule(elementName, componentName) {
  return {
    meta: {
      type: 'suggestion',
      docs: {
        description: `Disallow raw <${elementName}> elements outside components/ui/. Use <${componentName}> instead.`,
      },
      messages: {
        noRawElement: `Use <${componentName}> from components/ui instead of raw <${elementName}>.`,
      },
    },
    create(context) {
      const filename = context.filename || context.getFilename();
      // Allow raw elements inside the ui/ directory (where primitives are defined)
      if (filename.includes('components/ui/')) {
        return {};
      }
      return {
        JSXOpeningElement(node) {
          if (node.name.type === 'JSXIdentifier' && node.name.name === elementName) {
            context.report({ node, messageId: 'noRawElement' });
          }
        },
      };
    },
  };
}

const plugin = {
  meta: {
    name: 'eslint-plugin-ds',
    version: '1.0.0',
  },
  rules: {
    'no-raw-button': createNoRawElementRule('button', 'Button/IconButton'),
    'no-raw-input': createNoRawElementRule('input', 'TextInput/Checkbox'),
    'no-raw-select': createNoRawElementRule('select', 'Select'),
    'no-raw-textarea': createNoRawElementRule('textarea', 'Textarea'),
  },
};

export default plugin;
