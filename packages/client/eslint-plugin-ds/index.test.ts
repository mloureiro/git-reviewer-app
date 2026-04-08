/**
 * Unit tests for the custom ESLint design system plugin.
 * Tests each rule with valid (allowed) and invalid (banned) code examples.
 *
 * RuleTester.run() internally calls describe/it, so each .run() call must be
 * at the top level of the file (not nested inside another it() block).
 */

import { RuleTester } from 'eslint';
import plugin from './index.js';

// ---------------------------------------------------------------------------
// Shared tester — enable JSX parsing for all test cases
// ---------------------------------------------------------------------------

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// ---------------------------------------------------------------------------
// no-raw-button
// ---------------------------------------------------------------------------

ruleTester.run('ds/no-raw-button', plugin.rules['no-raw-button'], {
  valid: [
    // DS component — always allowed
    {
      code: '<Button onClick={handleClick}>Save</Button>',
      filename: 'src/components/SomeForm.tsx',
    },
    // IconButton variant — also allowed
    {
      code: '<IconButton icon="close" />',
      filename: 'src/pages/ReviewPage.tsx',
    },
    // Raw <button> inside components/ui/ — primitives define the element
    {
      code: '<button type="button" {...props}>{children}</button>',
      filename: 'src/components/ui/Button.tsx',
    },
    // Nested path still under components/ui/
    {
      code: '<button disabled>Loading…</button>',
      filename: 'src/components/ui/IconButton.tsx',
    },
    // Non-button HTML element — rule doesn't apply
    {
      code: '<input type="text" />',
      filename: 'src/components/SomeForm.tsx',
    },
  ],
  invalid: [
    // Bare <button> outside ui/ — must use DS component
    {
      code: '<button onClick={fn}>Click me</button>',
      filename: 'src/components/MyComponent.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
    // Inside a page file
    {
      code: '<button type="submit">Submit</button>',
      filename: 'src/pages/CreateReview.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
    // Self-closing variant
    {
      code: '<button />',
      filename: 'src/components/Toolbar.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
  ],
});

// ---------------------------------------------------------------------------
// no-raw-input
// ---------------------------------------------------------------------------

ruleTester.run('ds/no-raw-input', plugin.rules['no-raw-input'], {
  valid: [
    // DS TextInput
    {
      code: '<TextInput value={v} onChange={onChange} />',
      filename: 'src/components/SearchBar.tsx',
    },
    // DS Checkbox
    {
      code: '<Checkbox checked={checked} onChange={onChange} />',
      filename: 'src/components/FilterPanel.tsx',
    },
    // Raw <input> inside ui/ — allowed
    {
      code: '<input type="text" {...props} />',
      filename: 'src/components/ui/TextInput.tsx',
    },
    // Raw <input> inside nested ui/ path
    {
      code: '<input type="checkbox" {...props} />',
      filename: 'src/components/ui/Checkbox.tsx',
    },
    // Different element — rule doesn't apply
    {
      code: '<button>Go</button>',
      filename: 'src/components/SomeForm.tsx',
    },
  ],
  invalid: [
    {
      code: '<input type="text" value={v} onChange={fn} />',
      filename: 'src/components/MyForm.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
    {
      code: '<input type="checkbox" checked={c} onChange={fn} />',
      filename: 'src/pages/SettingsPage.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
    // type="hidden" is still a raw input
    {
      code: '<input type="hidden" name="csrf" />',
      filename: 'src/components/HiddenField.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
  ],
});

// ---------------------------------------------------------------------------
// no-raw-select
// ---------------------------------------------------------------------------

ruleTester.run('ds/no-raw-select', plugin.rules['no-raw-select'], {
  valid: [
    // DS Select
    {
      code: '<Select options={opts} value={v} onChange={fn} />',
      filename: 'src/components/Dropdown.tsx',
    },
    // Raw <select> inside ui/ — allowed
    {
      code: '<select {...props}>{children}</select>',
      filename: 'src/components/ui/Select.tsx',
    },
    // Different element
    {
      code: '<input type="text" />',
      filename: 'src/components/SomeForm.tsx',
    },
  ],
  invalid: [
    {
      code: '<select value={v} onChange={fn}><option>A</option></select>',
      filename: 'src/components/SortControls.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
    {
      code: '<select>{options.map(o => <option key={o.id}>{o.label}</option>)}</select>',
      filename: 'src/pages/ReviewPage.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
  ],
});

// ---------------------------------------------------------------------------
// no-raw-textarea
// ---------------------------------------------------------------------------

ruleTester.run('ds/no-raw-textarea', plugin.rules['no-raw-textarea'], {
  valid: [
    // DS Textarea
    {
      code: '<Textarea value={v} onChange={fn} />',
      filename: 'src/components/CommentEditor.tsx',
    },
    // Raw <textarea> inside ui/ — allowed
    {
      code: '<textarea {...props} />',
      filename: 'src/components/ui/Textarea.tsx',
    },
    // Different element
    {
      code: '<input type="text" />',
      filename: 'src/components/SomeForm.tsx',
    },
  ],
  invalid: [
    {
      code: '<textarea value={v} onChange={fn} />',
      filename: 'src/components/InlineCommentForm.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
    {
      code: '<textarea rows={5} placeholder="Add a comment…" />',
      filename: 'src/pages/ReviewPage.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
    // Multi-line raw textarea
    {
      code: '<textarea>\n  Default content\n</textarea>',
      filename: 'src/components/NoteEditor.tsx',
      errors: [{ messageId: 'noRawElement' }],
    },
  ],
});
