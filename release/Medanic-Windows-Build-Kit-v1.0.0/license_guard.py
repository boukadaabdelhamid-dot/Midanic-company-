"""
license_guard.py  —  نظام حماية برنامج ميدانيك من النسخ غير المرخصة
=======================================================================
الاستخدام في البرنامج الرئيسي (أضف هذا في أول سطور main):

    from license_guard import check_license
    if not check_license():
        raise SystemExit

=======================================================================
كيفية العمل:
1. أول تشغيل: يعمل البرنامج مجاناً لمدة 30 يوماً (فترة التجربة).
2. بعد 30 يوماً: يظهر مربع حوار يطلب مفتاح التفعيل.
3. المستخدم يرسل "معرّف الجهاز" (HWID) + الهاتف/الإيميل للمطوّر.
4. المطوّر يُشغّل keygen_tool.py ويُدخل HWID → يحصل على المفتاح.
5. المستخدم يُدخل المفتاح مرة واحدة فقط، ويُحفظ محلياً.
6. في كل تشغيل لاحق يتم التحقق تلقائياً خلال ثانية واحدة.
"""

import hashlib
import hmac
import os
import json
import base64
import uuid
import socket
import sys
import time
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path

# ── ثابت سري (لا تُغيّره بعد التوزيع) ──────────────────────────────────
_SALT = b"MEDANIC-DZ-2025-\xab\xcd\xef\x01\x23\x45\x67\x89"
_APP  = "medanic"
# ─────────────────────────────────────────────────────────────────────────

# ── إعدادات التجربة ومعلومات الاتصال ─────────────────────────────────────
TRIAL_DAYS      = 30
TRIAL_SECONDS   = TRIAL_DAYS * 24 * 60 * 60
_CONTACT_PHONE  = "+213 540 772 807"
_CONTACT_EMAIL  = "contact@midanic.com"
# ─────────────────────────────────────────────────────────────────────────


# ══════════════════════════════════════════════════════════════════════════
#  1. بصمة الجهاز
# ══════════════════════════════════════════════════════════════════════════

def _get_hwid() -> str:
    """تُعيد معرّف فريد للجهاز (MAC + hostname)، 16 حرفاً بالأحرف الكبيرة."""
    try:
        mac = format(uuid.getnode(), '012x').upper()
    except Exception:
        mac = "000000000000"
    try:
        host = socket.gethostname().upper()
    except Exception:
        host = "UNKNOWN"
    raw = f"{mac}|{host}"
    digest = hashlib.sha256(raw.encode('utf-8')).hexdigest()
    return digest[:16].upper()


# ══════════════════════════════════════════════════════════════════════════
#  2. توليد المفتاح والتحقق منه
# ══════════════════════════════════════════════════════════════════════════

def generate_key(hwid: str) -> str:
    """يُنتج مفتاح ترخيص مرتبط بـ HWID (يُستخدم من قِبل المطور فقط)."""
    h = hmac.new(_SALT, hwid.upper().encode('utf-8'), hashlib.sha256).digest()
    b32 = base64.b32encode(h).decode('ascii')[:20]
    return f"{b32[0:5]}-{b32[5:10]}-{b32[10:15]}-{b32[15:20]}"


def _verify(hwid: str, key: str) -> bool:
    """يتحقق من صحة المفتاح لهذا الجهاز."""
    clean = key.strip().upper().replace(" ", "")
    expected = generate_key(hwid).replace("-", "")
    return hmac.compare_digest(clean.replace("-", ""), expected)


# ══════════════════════════════════════════════════════════════════════════
#  3. تخزين الترخيص الدائم (مشفّر بسيط)
# ══════════════════════════════════════════════════════════════════════════

def _license_path() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home()))
    else:
        base = Path.home() / ".config"
    p = base / _APP
    p.mkdir(parents=True, exist_ok=True)
    return p / "license.dat"


def _xor(data: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


def _save_license(hwid: str, key: str):
    payload = json.dumps({"hwid": hwid, "key": key}).encode('utf-8')
    encrypted = _xor(payload, _SALT)
    _license_path().write_bytes(base64.b64encode(encrypted))


def _load_license() -> dict | None:
    path = _license_path()
    if not path.exists():
        return None
    try:
        raw = base64.b64decode(path.read_bytes())
        decrypted = _xor(raw, _SALT)
        return json.loads(decrypted.decode('utf-8'))
    except Exception:
        return None


# ══════════════════════════════════════════════════════════════════════════
#  4. إدارة فترة التجربة
# ══════════════════════════════════════════════════════════════════════════

def _trial_path() -> Path:
    return _license_path().parent / "trial.dat"


def _save_trial_start():
    """يُسجّل وقت أول تشغيل مشفراً مع HWID."""
    hwid = _get_hwid()
    payload = json.dumps({"hwid": hwid, "start": time.time()}).encode('utf-8')
    _trial_path().write_bytes(base64.b64encode(_xor(payload, _SALT)))


def _load_trial() -> dict | None:
    path = _trial_path()
    if not path.exists():
        return None
    try:
        raw = base64.b64decode(path.read_bytes())
        return json.loads(_xor(raw, _SALT).decode('utf-8'))
    except Exception:
        return None


def trial_remaining_seconds() -> float | None:
    """
    يُعيد الثواني المتبقية من فترة التجربة:
      None  → ترخيص دائم صالح، أو لم تبدأ التجربة بعد (أول تشغيل)
      > 0   → التجربة نشطة
      0.0   → التجربة انتهت
    """
    # ترخيص دائم صالح → لا عداد
    hwid = _get_hwid()
    lic = _load_license()
    if lic and lic.get("hwid") == hwid and _verify(hwid, lic.get("key", "")):
        return None

    data = _load_trial()
    if data is None:
        return None
    if data.get("hwid") != hwid:
        return 0.0   # ملف نُقل من جهاز آخر
    elapsed = time.time() - data.get("start", 0)
    return max(0.0, TRIAL_SECONDS - elapsed)


# ══════════════════════════════════════════════════════════════════════════
#  5. نافذة التفعيل
# ══════════════════════════════════════════════════════════════════════════

class _ActivationDialog(tk.Toplevel):
    """نافذة إدخال مفتاح التفعيل."""

    FONT_TITLE   = ("Arial", 15, "bold")
    FONT_BODY    = ("Arial", 10)
    FONT_CONTACT = ("Arial", 10, "bold")
    FONT_MONO    = ("Courier New", 12, "bold")
    COLOR_BG     = "#f8fafc"
    COLOR_CARD   = "#ffffff"
    COLOR_PRI    = "#2563eb"
    COLOR_DANGER = "#ef4444"
    COLOR_TXT    = "#1e293b"
    COLOR_LIGHT  = "#64748b"
    COLOR_WARN   = "#92400e"
    COLOR_WARN_BG= "#fef3c7"

    def __init__(self, parent, hwid: str, trial_expired: bool = False):
        super().__init__(parent)
        self.hwid          = hwid
        self.trial_expired = trial_expired
        self.success       = False
        self._build()
        self.grab_set()
        self.resizable(False, False)
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.wait_window()

    def _build(self):
        self.title("تفعيل البرنامج — ميدانيك")
        self.configure(bg=self.COLOR_BG)
        h = 480 if self.trial_expired else 420
        self.geometry(f"540x{h}")

        # أيقونة البرنامج
        try:
            base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
            ico = os.path.join(base, "medanic_icon.ico")
            if os.path.exists(ico):
                self.iconbitmap(ico)
        except Exception:
            pass

        # ── رأس ──────────────────────────────────────────────────────────
        hdr = tk.Frame(self, bg=self.COLOR_PRI, pady=18)
        hdr.pack(fill="x")
        tk.Label(hdr, text="🔐  تفعيل البرنامج",
                 font=self.FONT_TITLE, bg=self.COLOR_PRI, fg="white").pack()
        tk.Label(hdr, text="برنامج ميدانيك — إدارة مدرسة تعليم السياقة",
                 font=self.FONT_BODY, bg=self.COLOR_PRI, fg="#bfdbfe").pack()

        # ── جسم ──────────────────────────────────────────────────────────
        body = tk.Frame(self, bg=self.COLOR_BG, padx=30, pady=16)
        body.pack(fill="both", expand=True)

        # رسالة الحالة
        if self.trial_expired:
            # بطاقة تحذير انتهاء التجربة
            warn_card = tk.Frame(body, bg=self.COLOR_WARN_BG,
                                 highlightthickness=1,
                                 highlightbackground="#fbbf24",
                                 padx=14, pady=12)
            warn_card.pack(fill="x", pady=(0, 14))
            tk.Label(warn_card,
                     text="⏰  انتهت فترة التجربة المجانية (30 يوماً)",
                     font=("Arial", 11, "bold"),
                     bg=self.COLOR_WARN_BG, fg=self.COLOR_WARN,
                     justify="right", anchor="e").pack(fill="x")
            tk.Label(warn_card,
                     text="لتفعيل البرنامج، أرسل معرّف جهازك (HWID) إلى المطوّر:",
                     font=self.FONT_BODY,
                     bg=self.COLOR_WARN_BG, fg=self.COLOR_WARN,
                     justify="right", anchor="e").pack(fill="x", pady=(6, 4))
            # معلومات الاتصال
            contact_fr = tk.Frame(warn_card, bg=self.COLOR_WARN_BG)
            contact_fr.pack(fill="x", pady=(2, 0))
            tk.Label(contact_fr,
                     text=f"📞  {_CONTACT_PHONE}",
                     font=self.FONT_CONTACT,
                     bg=self.COLOR_WARN_BG, fg="#1e40af",
                     anchor="e").pack(anchor="e")
            tk.Label(contact_fr,
                     text=f"✉️  {_CONTACT_EMAIL}",
                     font=self.FONT_CONTACT,
                     bg=self.COLOR_WARN_BG, fg="#1e40af",
                     anchor="e").pack(anchor="e")
        else:
            tk.Label(body,
                     text="هذه النسخة غير مفعّلة. أرسل معرّف جهازك للمطوّر للحصول على مفتاح التفعيل.",
                     font=self.FONT_BODY, bg=self.COLOR_BG, fg=self.COLOR_TXT,
                     wraplength=460, justify="right").pack(anchor="e", pady=(0, 14))

        # HWID
        tk.Label(body, text="معرّف جهازك (HWID) — أرسل هذا الرمز للمطوّر:",
                 font=self.FONT_BODY, bg=self.COLOR_BG,
                 fg=self.COLOR_LIGHT).pack(anchor="e")
        hwid_fr = tk.Frame(body, bg=self.COLOR_CARD,
                            highlightthickness=1, highlightbackground="#cbd5e1")
        hwid_fr.pack(fill="x", pady=(4, 8))
        self._hwid_var = tk.StringVar(value=self.hwid)
        tk.Entry(hwid_fr, textvariable=self._hwid_var,
                 font=self.FONT_MONO, state="readonly",
                 readonlybackground=self.COLOR_CARD,
                 fg=self.COLOR_PRI, justify="center",
                 relief="flat", bd=6).pack(fill="x")

        tk.Button(body, text="📋  نسخ HWID",
                  font=self.FONT_BODY, bg="#e0e7ff", fg=self.COLOR_PRI,
                  relief="flat", cursor="hand2", bd=0, padx=10, pady=4,
                  command=self._copy_hwid).pack(anchor="e", pady=(0, 14))

        # مفتاح التفعيل
        tk.Label(body, text="مفتاح التفعيل:",
                 font=self.FONT_BODY, bg=self.COLOR_BG,
                 fg=self.COLOR_TXT).pack(anchor="e")
        key_fr = tk.Frame(body, bg=self.COLOR_CARD,
                           highlightthickness=1, highlightbackground="#cbd5e1")
        key_fr.pack(fill="x", pady=(4, 4))
        self._key_var = tk.StringVar()
        self._key_var.trace_add("write", self._fmt_key)
        tk.Entry(key_fr, textvariable=self._key_var,
                 font=self.FONT_MONO, justify="center",
                 relief="flat", bd=6).pack(fill="x")

        self._err_lbl = tk.Label(body, text="", font=("Arial", 9),
                                  bg=self.COLOR_BG, fg=self.COLOR_DANGER)
        self._err_lbl.pack(anchor="e", pady=(0, 10))

        tk.Button(body, text="✔  تفعيل",
                  font=("Arial", 11, "bold"),
                  bg=self.COLOR_PRI, fg="white",
                  activebackground="#1d4ed8",
                  relief="flat", cursor="hand2", bd=0, padx=20, pady=8,
                  command=self._activate).pack(fill="x")

    # ── مساعدات ──────────────────────────────────────────────────────────

    def _copy_hwid(self):
        self.clipboard_clear()
        self.clipboard_append(self.hwid)
        messagebox.showinfo("تم النسخ", "تم نسخ HWID إلى الحافظة.", parent=self)

    def _fmt_key(self, *_):
        """يُنسّق المفتاح تلقائياً بصيغة XXXXX-XXXXX-XXXXX-XXXXX."""
        raw = self._key_var.get().upper().replace("-", "").replace(" ", "")
        if len(raw) > 20:
            raw = raw[:20]
        parts = [raw[i:i+5] for i in range(0, len(raw), 5) if raw[i:i+5]]
        formatted = "-".join(parts)
        self._key_var.trace_remove("write", self._key_var.trace_info()[0][1])
        self._key_var.set(formatted)
        self._key_var.trace_add("write", self._fmt_key)

    def _activate(self):
        key = self._key_var.get().strip()
        if not key:
            self._err_lbl.config(text="أدخل مفتاح التفعيل أولاً.")
            return
        if _verify(self.hwid, key):
            _save_license(self.hwid, key)
            self.success = True
            messagebox.showinfo("تم التفعيل ✔",
                                "تم تفعيل البرنامج بنجاح!\nشكراً لاستخدامك برنامج ميدانيك.",
                                parent=self)
            self.destroy()
        else:
            self._err_lbl.config(text="❌  المفتاح غير صحيح. تحقق من المفتاح وأعد المحاولة.")

    def _on_close(self):
        if not self.success:
            self.destroy()


# ══════════════════════════════════════════════════════════════════════════
#  6. الدالة الرئيسية — استدعِها في بداية main()
# ══════════════════════════════════════════════════════════════════════════

def check_license(root: tk.Tk | None = None) -> bool:
    """
    تتحقق من وجود ترخيص صالح أو فترة تجربة نشطة.

    - ترخيص دائم صالح           → True مباشرةً
    - أول تشغيل (لا trial.dat)  → يبدأ عداد 30 يوماً → True
    - التجربة نشطة (< 30 يوماً) → True
    - التجربة انتهت             → نافذة التفعيل → True/False
    - المستخدم يرفض التفعيل     → False (أنهِ البرنامج)

    مثال الاستخدام:
        root = tk.Tk()
        if not check_license(root):
            root.destroy()
            raise SystemExit
    """
    hwid = _get_hwid()
    data = _load_license()

    # ① ترخيص دائم صالح
    if data and data.get("hwid") == hwid and _verify(hwid, data.get("key", "")):
        return True

    # ② فترة التجربة
    remaining = trial_remaining_seconds()
    if remaining is None:
        # أول تشغيل → ابدأ عداد التجربة
        _save_trial_start()
        return True
    if remaining > 0:
        # التجربة لا تزال نشطة
        return True

    # ③ التجربة انتهت → نافذة التفعيل
    _owner = root
    if _owner is None:
        _owner = tk.Tk()
        _owner.withdraw()

    dlg = _ActivationDialog(_owner, hwid, trial_expired=True)
    return dlg.success
