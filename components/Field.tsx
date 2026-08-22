const inputClass = "field-input";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </span>
      )}
    </label>
  );
}

export function Input(props: React.ComponentProps<"input">) {
  return <input {...props} className={inputClass} />;
}

export function Select(props: React.ComponentProps<"select">) {
  return <select {...props} className={inputClass} />;
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "notice";
  children: React.ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200";

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`animate-[fade-in_300ms_ease-out] rounded-xl border px-3.5 py-2.5 text-sm backdrop-blur-md ${styles}`}
    >
      {children}
    </p>
  );
}
