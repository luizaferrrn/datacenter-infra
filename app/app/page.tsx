import FormularioCliente from "./formulario-cliente";

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Formulario</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Lo que escribes se guarda automáticamente. Si cierras la pestaña, el borrador reaparece al volver.
      </p>
      <FormularioCliente />
    </main>
  );
}
