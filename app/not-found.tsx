export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-2 font-display text-5xl">Record not found</h1>
      <a href="/" className="mt-4 inline-block rounded-full bg-foreground px-6 py-3 text-sm text-background">Back to command centre</a>
    </div>
  );
}
