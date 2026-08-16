import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { db, contactMessagesTable, trialRequestsTable, demoRequestsTable, newsletterSubscribersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
  await db.insert(trialRequestsTable).values({
    ...parsed.data,
    productId: parsed.data.productId ? String(parsed.data.productId) : null,
  });
  res.status(201).json({ message: "Trial request submitted, we will contact you shortly" });
});

router.post("/demo-request", contactLimiter, async (req, res): Promise<void> => {
  const parsed = RequestDemoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.insert(demoRequestsTable).values({
    ...parsed.data,
    productId: parsed.data.productId ? String(parsed.data.productId) : null,
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
