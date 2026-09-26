import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type RequestAnswer = string | string[];
export type RequestAnswers = Record<string, RequestAnswer>;
export type RequestFieldConfig = {
  key: string;
  label: { en: string; fr: string; ar: string };
  type: "text" | "number" | "textarea" | "select" | "multiselect";
  required: boolean;
  options?: Array<{
    value: string;
    label: { en: string; fr: string; ar: string };
  }>;
};
type SupportedLanguage = "en" | "fr" | "ar";

export function hasCompleteRequestAnswers(
  fields: RequestFieldConfig[],
  answers: RequestAnswers,
): boolean {
  return fields.every((field) => {
    const value = answers[field.key];
    if (value === undefined) return !field.required;
    if (Array.isArray(value)) {
      if (field.type !== "multiselect") return false;
      if (field.required && value.length === 0) return false;
      const allowed = new Set(field.options?.map((option) => option.value) ?? []);
      return value.every((item) => allowed.has(item));
    }
    if (field.required && !value.trim()) return false;
    if (field.type === "number" && value && !/^\d+$/.test(value)) return false;
    if (
      field.type === "select" &&
      value &&
      !field.options?.some((option) => option.value === value)
    ) return false;
    return true;
  });
}

export function ProductRequestFields({
  fields,
  answers,
  language,
  onChange,
}: {
  fields: RequestFieldConfig[];
  answers: RequestAnswers;
  language: string;
  onChange: (key: string, value: RequestAnswer) => void;
}) {
  const locale: SupportedLanguage = language.startsWith("ar")
    ? "ar"
    : language.startsWith("fr")
      ? "fr"
      : "en";

  if (fields.length === 0) return null;

  return (
    <section className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      {fields.map((field) => {
        const label = field.label[locale] || field.label.en;
        const value = answers[field.key];
        return (
          <div key={field.key} className="space-y-2">
            <label htmlFor={`request-field-${field.key}`} className="text-sm font-medium">
              {label}{field.required ? <span className="text-destructive"> *</span> : null}
            </label>
            {field.type === "textarea" ? (
              <Textarea
                id={`request-field-${field.key}`}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => onChange(field.key, event.target.value)}
                required={field.required}
                rows={3}
              />
            ) : field.type === "select" ? (
              <select
                id={`request-field-${field.key}`}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={typeof value === "string" ? value : ""}
                onChange={(event) => onChange(field.key, event.target.value)}
                required={field.required}
              >
                <option value="" />
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label[locale] || option.label.en}
                  </option>
                ))}
              </select>
            ) : field.type === "multiselect" ? (
              <fieldset className="space-y-2" aria-label={label}>
                <legend className="sr-only">{label}</legend>
                {field.options?.map((option) => {
                  const selected = Array.isArray(value) && value.includes(option.value);
                  return (
                    <label key={option.value} className="flex items-center gap-2 text-sm font-normal">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => {
                          const current = Array.isArray(value) ? value : [];
                          onChange(
                            field.key,
                            event.target.checked
                              ? [...current, option.value]
                              : current.filter((item) => item !== option.value),
                          );
                        }}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      {option.label[locale] || option.label.en}
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <Input
                id={`request-field-${field.key}`}
                type={field.type === "number" ? "number" : "text"}
                min={field.type === "number" ? 0 : undefined}
                step={field.type === "number" ? 1 : undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => onChange(field.key, event.target.value)}
                required={field.required}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}