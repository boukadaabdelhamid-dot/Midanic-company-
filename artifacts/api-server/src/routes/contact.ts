import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import {
  db,
  contactMessagesTable,
  trialRequestsTable,
  demoRequestsTable,
  newsletterSubscribersTable,
  productsTable,
  type ProductRequestField,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  SubmitContactBody,
  RequestTrialBody,
  RequestDemoBody,
  SubscribeNewsletterBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many requests, please try again later" },
});

type RequestAnswerValue = string | string[];
type SavedRequestAnswer = {
  label: ProductRequestField["label"];
  value: RequestAnswerValue;
  options?: ProductRequestField["options"];
};

function validateCustomAnswers(
  fields: ProductRequestField[],
  submitted: Record<string, RequestAnswerValue> | undefined,
): { answers?: Record<string, SavedRequestAnswer>; error?: string } {
  const values = submitted ?? {};
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  for (const key of Object.keys(values)) {
    if (!fieldByKey.has(key)) return { error: "Unknown product request field" };
  }

  const answers: Record<string, SavedRequestAnswer> = {};
  for (const field of fields) {
    const value = values[field.key];
    const empty =
      value === undefined ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      if (field.required) return { error: `Please fill in: ${field.label.en}` };
      continue;
    }

    if (field.type === "multiselect") {
      if (!Array.isArray(value) || value.length > 30) return { error: `Invalid answer for: ${field.label.en}` };
      const validOptions = new Set(field.options?.map((option) => option.value) ?? []);
      if (new Set(value).size !== value.length || value.some((item) => !validOptions.has(item))) {
        return { error: `Invalid choice for: ${field.label.en}` };
      }
    } else {
      if (typeof value !== "string") return { error: `Invalid answer for: ${field.label.en}` };
      if (field.type === "number" && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) {
        return { error: `Enter a whole number for: ${field.label.en}` };
      }
      if ((field.type === "select") && !field.options?.some((option) => option.value === value)) {
        return { error: `Invalid choice for: ${field.label.en}` };
      }
      if (value.length > 2000) return { error: `Answer is too long for: ${field.label.en}` };
    }

    answers[field.key] = {
      label: field.label,
      value,
      ...(field.options
        ? {
            options: field.options.filter((option) =>
              Array.isArray(value) ? value.includes(option.value) : value === option.value,
            ),
          }
        : {}),
    };
  }
  return { answers };
}

async function getPublishedProduct(productId: number) {
  const [product] = await db
    .select({
      id: productsTable.id,
      productType: productsTable.productType,
      requestFormFields: productsTable.requestFormFields,
    })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.published, true)))
    .limit(1);
  return product;
}

router.post("/contact", contactLimiter, async (req, res): Promise<void> => {
  const parsed = SubmitContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.insert(contactMessagesTable).values(parsed.data);
  res.status(201).json({ message: "Message received, we will get back to you soon" });
});

router.post("/trial-request", contactLimiter, async (req, res): Promise<void> => {
  const parsed = RequestTrialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const product = await getPublishedProduct(parsed.data.productId);
  if (!product) {
    res.status(400).json({ error: "Choose a published product" });
    return;
  }
  const fields = product.productType === "erp" ? product.requestFormFields : [];
  const custom = validateCustomAnswers(fields, parsed.data.customAnswers);
  if (custom.error) {
    res.status(400).json({ error: custom.error });
    return;
  }
  await db.insert(trialRequestsTable).values({
    ...parsed.data,
    productId: parsed.data.productId ? String(parsed.data.productId) : null,
    customAnswers: custom.answers ?? {},
  });
  res.status(201).json({ message: "Trial request submitted, we will contact you shortly" });
});

router.post("/demo-request", contactLimiter, async (req, res): Promise<void> => {
  const parsed = RequestDemoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const product = await getPublishedProduct(parsed.data.productId);
  if (!product) {
    res.status(400).json({ error: "Choose a published product" });
    return;
  }
  const fields = product.productType === "erp" ? product.requestFormFields : [];
  const custom = validateCustomAnswers(fields, parsed.data.customAnswers);
  if (custom.error) {
    res.status(400).json({ error: custom.error });
    return;
  }
  await db.insert(demoRequestsTable).values({
    ...parsed.data,
    productId: parsed.data.productId ? String(parsed.data.productId) : null,
    customAnswers: custom.answers ?? {},
  });
  res.status(201).json({ message: "Demo request submitted, we will contact you to schedule" });
});

router.post("/newsletter/subscribe", contactLimiter, async (req, res): Promise<void> => {
  const parsed = SubscribeNewsletterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.email, parsed.data.email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Already subscribed" });
    return;
  }
  await db.insert(newsletterSubscribersTable).values({
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name,
  });
  res.status(201).json({ message: "Successfully subscribed to newsletter" });
});

export default router;
