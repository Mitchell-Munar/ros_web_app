export const profile = { id: 'default', name: 'Default robot', url: import.meta.env.VITE_FOXGLOVE_URL || 'ws://localhost:8765' };
export const useMock = import.meta.env.VITE_USE_MOCK === 'true';
