import React from 'react';

export function useAsyncData(loader, deps = [], options = {}) {
  const [state, setState] = React.useState({
    data: options.initialData ?? null,
    loading: Boolean(options.loadOnMount ?? true),
    error: null,
  });
  const loaderRef = React.useRef(loader);

  React.useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const reload = React.useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
      if (options.throwOnError) throw error;
      return null;
    }
  }, [options.throwOnError]);

  React.useEffect(() => {
    if (options.loadOnMount === false) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    loaderRef.current()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState((current) => ({ ...current, loading: false, error }));
      });
    return () => {
      active = false;
    };
  }, deps);

  return { ...state, reload, setData: (data) => setState((current) => ({ ...current, data })) };
}

