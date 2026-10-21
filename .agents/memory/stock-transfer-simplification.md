---
name: Stock transfer simplification
description: User-approved scope for reducing transfer steps without removing destination confirmations.
---

مسار الإرسال الذي يبدأ من المصدر هو إرسال مباشر: إنشاء التحويل، ثم تجهيزه، ثم إرساله دون موافقة مسبقة من الوجهة؛ تفتح الوجهة التفاصيل وتؤكد الاستلام. يبقى طلب التحويل العادي مسارًا منفصلًا بموافقة الوجهة وتأكيد الاستلام، مع دمج تجهيز المصدر وشحنه في إجراء واحد.

**Why:** حدّد المستخدم أن «Envoyer vers un autre magasin» يجب أن يتجاوز موافقة الوجهة، ووافق سابقًا على اختصار مسار الطلب العادي دون حذف تأكيد الاستلام.

**How to apply:** لا توجّه الإرسال الصادر إلى مسار طلب الموافقة. أبقِ «Demander depuis un autre magasin» منفصلًا، ولا تغيّر مسار الطلب العادي إلا ضمن نطاق متفق عليه.
