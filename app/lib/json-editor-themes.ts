import type { Theme } from 'json-edit-react';

export const jsonEditorLightTheme: Theme = {
  styles: {
    container: {
      backgroundColor: 'transparent',
      fontFamily: 'inherit',
    },
    property: 'oklch(0.554 0.046 257.417)', // muted-foreground
    itemCount: 'oklch(0.554 0.046 257.417)', // muted-foreground
    bracket: 'oklch(0.704 0.04 256.788)', // ring color
    string: 'oklch(0.65 0.19 50)', // #ED7117 orange
    number: 'oklch(0.65 0.19 50)', // #ED7117 orange
    boolean: 'oklch(0.65 0.19 50)', // #ED7117 orange
    null: 'oklch(0.65 0.19 50)', // #ED7117 orange
    iconEdit: 'oklch(0.488 0.243 264.376)',
    iconDelete: 'oklch(0.577 0.245 27.325)', // destructive
    iconAdd: 'oklch(0.6 0.118 184.704)', // chart-2
    iconCopy: 'oklch(0.554 0.046 257.417)',
    iconOk: 'oklch(0.6 0.118 184.704)',
    iconCancel: 'oklch(0.577 0.245 27.325)',
    input: {
      backgroundColor: 'oklch(0.968 0.007 247.896)', // muted
      color: 'oklch(0.129 0.042 264.695)', // foreground
      border: '1px solid oklch(0.929 0.013 255.508)', // border
      borderRadius: '0.375rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
    },
  },
};

export const jsonEditorDarkTheme: Theme = {
  styles: {
    container: {
      backgroundColor: 'transparent',
      fontFamily: 'inherit',
    },
    property: 'lab(66.128% 0 0)', // muted-foreground (zinc)
    itemCount: 'lab(74% 0 0)', // soft muted white
    bracket: 'lab(48.496% 0 0)', // ring (zinc)
    string: 'lab(70% 45 65)', // warm orange (consistent with number)
    number: 'lab(70% 45 65)', // warm orange
    boolean: 'lab(70% 45 65)', // warm orange (consistent with number)
    null: 'lab(70% 45 65)', // warm orange (consistent with number)
    iconEdit: 'lab(36.9089% 35.0961 -85.6872)', // sidebar-primary (blue)
    iconDelete: 'lab(63.7053% 60.745 31.3109)', // destructive (red)
    iconAdd: 'lab(65% -35 30)', // chart-2 (teal)
    iconCopy: 'lab(66.128% 0 0)',
    iconOk: 'lab(65% -35 30)',
    iconCancel: 'lab(63.7053% 60.745 31.3109)',
    input: {
      backgroundColor: 'lab(15.204% 0 0)', // muted (zinc)
      color: 'lab(98.26% 0 0)', // foreground (zinc)
      border: '1px solid lab(100% 0 0 / 15%)', // input (zinc)
      borderRadius: '0.375rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
    },
  },
};
