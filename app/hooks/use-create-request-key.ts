import { nanoid } from 'nanoid';
import { useRef } from 'react';
import { useLocation } from 'react-router';

// Keep the same key when an unchanged form is retried after a lost response.
export const useCreateRequestKey = () => {
  const location = useLocation();
  const request = useRef<{
    body: string;
    locationKey: string;
    key: string;
  } | null>(null);
  return (form: HTMLFormElement) => {
    const body = JSON.stringify(
      [...new FormData(form).entries()].filter(
        ([name]) => name !== 'requestKey',
      ),
    );
    if (
      request.current?.body !== body ||
      request.current.locationKey !== location.key
    ) {
      request.current = { body, locationKey: location.key, key: nanoid() };
    }
    const input = form.elements.namedItem('requestKey');
    if (input instanceof HTMLInputElement) input.value = request.current.key;
  };
};
