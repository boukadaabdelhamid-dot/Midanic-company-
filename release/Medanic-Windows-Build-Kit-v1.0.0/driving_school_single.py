# -*- coding: utf-8 -*-
"""
نظام إدارة مدرسة تعليم السياقة - الجزائر
Driving School Management System - Algeria
Python 3 | Tkinter | SQLite | reportlab + arabic_reshaper + python-bidi (PDF عربي)

طريقة التشغيل:
    1. ثبّت المكتبات:
        pip install reportlab arabic_reshaper python-bidi
    2. شغّل البرنامج:
        python driving_school_single.py
"""

import os
import sys
import sqlite3
import hashlib
import json
import shutil
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import date, datetime, timedelta

try:
    from PIL import Image, ImageTk
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# ----- مكتبة PDF -----
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

# ----- دعم العربية للـ PDF -----
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_ARABIC_LIBS = True
except ImportError:
    HAS_ARABIC_LIBS = False


# ============================================================================
#  نظام الترجمة (عربي / فرنسي)
# ============================================================================

LANG = "ar"   # القيمة الافتراضية — تُحمَّل من قاعدة البيانات عند بدء التشغيل

STRINGS: dict = {
    # ── التنقل ──────────────────────────────────────────────────────────────
    "nav_dashboard":   {"ar": "الرئيسية",          "fr": "Tableau de bord"},
    "nav_school_info": {"ar": "معلومات المدرسة",    "fr": "Info École"},
    "nav_candidates":  {"ar": "المترشحون",          "fr": "Candidats"},
    "nav_instructors": {"ar": "الممرنون",           "fr": "Moniteurs"},
    "nav_training":    {"ar": "مراحل التكوين",     "fr": "Étapes Formation"},
    "nav_schedule":    {"ar": "الجدول الزمني",     "fr": "Planning"},
    "nav_payments":    {"ar": "المدفوعات",          "fr": "Paiements"},
    "nav_expenses":    {"ar": "المصاريف",           "fr": "Dépenses"},
    "nav_reports":     {"ar": "التقارير",           "fr": "Rapports"},
    "nav_documents":   {"ar": "طباعة الوثائق",     "fr": "Imprimer Docs"},
    "nav_graduates":   {"ar": "المتخرجون",          "fr": "Diplômés"},
    # ── أزرار شائعة ─────────────────────────────────────────────────────────
    "btn_save":          {"ar": "حفظ",             "fr": "Enregistrer"},
    "btn_save_info":     {"ar": "حفظ المعلومات",   "fr": "Enregistrer"},
    "btn_reload":        {"ar": "إعادة تحميل",     "fr": "Recharger"},
    "btn_add":           {"ar": "إضافة",           "fr": "Ajouter"},
    "btn_edit":          {"ar": "تعديل",           "fr": "Modifier"},
    "btn_delete":        {"ar": "حذف",             "fr": "Supprimer"},
    "btn_cancel":        {"ar": "إلغاء",           "fr": "Annuler"},
    "btn_search":        {"ar": "بحث",             "fr": "Rechercher"},
    "btn_refresh":       {"ar": "تحديث",           "fr": "Actualiser"},
    "btn_print":         {"ar": "طباعة",           "fr": "Imprimer"},
    "btn_apply":         {"ar": "تطبيق",           "fr": "Appliquer"},
    "btn_all_periods":   {"ar": "كل الفترات",      "fr": "Toutes périodes"},
    "btn_close":         {"ar": "إغلاق",           "fr": "Fermer"},
    "btn_clear":         {"ar": "مسح الحقول",      "fr": "Effacer"},
    "btn_users":         {"ar": "👥  إدارة المستخدمين", "fr": "👥  Utilisateurs"},
    "btn_logout":        {"ar": "⏻  تسجيل الخروج", "fr": "⏻  Déconnexion"},
    "btn_lang_switch":   {"ar": "🌐 Français",      "fr": "🌐 عربي"},
    # ── لوحة المعلومات ──────────────────────────────────────────────────────
    "dash_title":        {"ar": "📊  لوحة المعلومات",           "fr": "📊  Tableau de bord"},
    "dash_subtitle":     {"ar": "نظرة شاملة على نشاط المدرسة", "fr": "Vue d'ensemble de l'activité"},
    "dash_candidates":   {"ar": "المترشحون",                    "fr": "Candidats"},
    "dash_instructors":  {"ar": "الممرنون",                     "fr": "Moniteurs"},
    "dash_payments":     {"ar": "المدفوعات (دج)",               "fr": "Paiements (DA)"},
    "dash_expenses":     {"ar": "المصاريف (دج)",                "fr": "Dépenses (DA)"},
    "dash_profit":       {"ar": "💎  الأرباح الصافية لسنة",    "fr": "💎  Bénéfice net année"},
    "dash_today_sess":   {"ar": "حصص اليوم",                    "fr": "Séances du jour"},
    "dash_no_sessions":  {"ar": "لا توجد حصص مجدولة لهذا اليوم","fr": "Aucune séance planifiée aujourd'hui"},
    "dash_see_details":  {"ar": "← عرض التفاصيل",              "fr": "→ Voir détails"},
    "dash_success_rate": {"ar": "نجاح",                         "fr": "Réussite"},
    "dash_attempts":     {"ar": "المحاولات:",                   "fr": "Tentatives:"},
    "dash_passed_lbl":   {"ar": "ناجح:",                        "fr": "Réussi:"},
    "dash_failed_lbl":   {"ar": "راسب:",                        "fr": "Échoué:"},
    # ── معلومات المدرسة ──────────────────────────────────────────────────────
    "school_title":    {"ar": "🏫  معلومات المدرسة",                                         "fr": "🏫  Informations École"},
    "school_subtitle": {"ar": "بيانات المدرسة الرسمية المستعملة في الوثائق المطبوعة",        "fr": "Données officielles utilisées dans les documents imprimés"},
    "school_basic":    {"ar": "البيانات الأساسية",                                            "fr": "Données de base"},
    "school_name":     {"ar": "اسم المدرسة",                                                  "fr": "Nom de l'école"},
    "school_phone":    {"ar": "رقم الهاتف",                                                   "fr": "Téléphone"},
    "school_address":  {"ar": "العنوان",                                                      "fr": "Adresse"},
    "school_cr":       {"ar": "رقم السجل التجاري",                                            "fr": "Registre commercial"},
    "school_accred":   {"ar": "رقم الاعتماد",                                                 "fr": "N° accréditation"},
    "school_wilaya":   {"ar": "الولاية",                                                      "fr": "Wilaya"},
    "school_saved":    {"ar": "تم حفظ معلومات المدرسة بنجاح",                                "fr": "Informations enregistrées avec succès"},
    "school_err_name": {"ar": "يرجى إدخال اسم المدرسة",                                      "fr": "Veuillez saisir le nom de l'école"},
    # ── المترشحون ────────────────────────────────────────────────────────────
    "cand_title":       {"ar": "🧾  إدارة المترشحين",                          "fr": "🧾  Gestion des candidats"},
    "cand_subtitle":    {"ar": "إضافة وتعديل وحذف وعرض كل المترشحين",         "fr": "Ajouter, modifier, supprimer des candidats"},
    "cand_new":         {"ar": "تسجيل مترشح جديد",                            "fr": "Nouveau candidat"},
    "cand_edit":        {"ar": "تعديل المحدد",                                "fr": "Modifier"},
    "cand_exam":        {"ar": "نتائج الامتحانات",                            "fr": "Résultats examens"},
    "cand_card":        {"ar": "بطاقة التكوين",                               "fr": "Fiche formation"},
    "cand_print_form":  {"ar": "طباعة الاستمارة",                             "fr": "Imprimer formulaire"},
    "cand_delete":      {"ar": "حذف",                                         "fr": "Supprimer"},
    "cand_hint":        {"ar": "💡  لتسجيل مترشح جديد: اضغط على زر  «➕ تسجيل مترشح جديد»  أعلاه.",
                         "fr": "💡  Pour inscrire un candidat: cliquez sur  «➕ Nouveau candidat»  ci-dessus."},
    "cand_search":      {"ar": "ابحث بالاسم أو اللقب أو الهاتف:",             "fr": "Rechercher par nom ou téléphone:"},
    "cand_col_num":     {"ar": "رقم",        "fr": "N°"},
    "cand_col_lname":   {"ar": "اللقب",      "fr": "Nom"},
    "cand_col_fname":   {"ar": "الاسم",      "fr": "Prénom"},
    "cand_col_nid":     {"ar": "رقم التعريف","fr": "N° identité"},
    "cand_col_gender":  {"ar": "الجنس",      "fr": "Sexe"},
    "cand_col_phone":   {"ar": "الهاتف",     "fr": "Téléphone"},
    "cand_col_license": {"ar": "الرخصة",     "fr": "Permis"},
    "cand_col_inst":    {"ar": "الممرن",     "fr": "Moniteur"},
    "cand_col_amount":  {"ar": "المبلغ",     "fr": "Montant"},
    "cand_col_date":    {"ar": "تاريخ التسجيل", "fr": "Date inscription"},
    "cand_add_title":   {"ar": "تسجيل مترشح جديد", "fr": "Nouveau candidat"},
    "cand_edit_title":  {"ar": "تعديل بيانات المترشح", "fr": "Modifier candidat"},
    # ── الممرنون ─────────────────────────────────────────────────────────────
    "inst_title":      {"ar": "🚗  إدارة الممرنين",               "fr": "🚗  Gestion des moniteurs"},
    "inst_subtitle":   {"ar": "إدارة الممرنين العاملين في المدرسة","fr": "Gestion des moniteurs de l'école"},
    "inst_add":        {"ar": "إضافة ممرن",                       "fr": "Ajouter moniteur"},
    "inst_edit":       {"ar": "تعديل",                            "fr": "Modifier"},
    "inst_contract":   {"ar": "عقد العمل",                        "fr": "Contrat de travail"},
    "inst_delete":     {"ar": "حذف",                              "fr": "Supprimer"},
    "inst_search":     {"ar": "ابحث بالاسم أو الهاتف:",           "fr": "Rechercher par nom ou téléphone:"},
    "inst_col_num":    {"ar": "رقم",           "fr": "N°"},
    "inst_col_lname":  {"ar": "اللقب",         "fr": "Nom"},
    "inst_col_fname":  {"ar": "الاسم",         "fr": "Prénom"},
    "inst_col_gender": {"ar": "الجنس",         "fr": "Sexe"},
    "inst_col_phone":  {"ar": "الهاتف",        "fr": "Téléphone"},
    "inst_col_cats":   {"ar": "الأصناف",       "fr": "Catégories"},
    "inst_col_exp":    {"ar": "سنوات الخبرة",  "fr": "Années exp."},
    "inst_added":           {"ar": "تم إضافة الممرن بنجاح",            "fr": "Moniteur ajouté avec succès"},
    "inst_updated":         {"ar": "تم تعديل بيانات الممرن",           "fr": "Moniteur modifié avec succès"},
    "inst_sel_first":       {"ar": "يرجى تحديد ممرن من القائمة",       "fr": "Sélectionnez un moniteur d'abord"},
    "inst_no_cands":        {"ar": "لا يوجد مترشحون مسجلون لهذا الممرن","fr": "Aucun candidat inscrit pour ce moniteur"},
    "inst_pick_cand":       {"ar": "اختر المترشح",                     "fr": "Choisir candidat"},
    "inst_pick_cand_label": {"ar": "اختر المترشح لطباعة بطاقة التكوين له:", "fr": "Choisissez le candidat pour imprimer la fiche:"},
    "inst_col_fname_lname": {"ar": "الاسم واللقب",                     "fr": "Nom et prénom"},
    "inst_print_card":      {"ar": "طباعة البطاقة",                    "fr": "Imprimer fiche"},
    # ── المدفوعات ────────────────────────────────────────────────────────────
    "pay_title":       {"ar": "💰  إدارة المدفوعات",                    "fr": "💰  Gestion des paiements"},
    "pay_subtitle":    {"ar": "تسجيل مدفوعات المترشحين ومتابعة المتبقي","fr": "Suivi des paiements des candidats"},
    "pay_total_lbl":   {"ar": "المبلغ الإجمالي: -",                     "fr": "Montant total: -"},
    "pay_paid_lbl":    {"ar": "المدفوع: -",                             "fr": "Payé: -"},
    "pay_remain_lbl":  {"ar": "المتبقي: -",                             "fr": "Restant: -"},
    "pay_history":     {"ar": "عرض سجل الدفعات (التاريخ)",              "fr": "Historique des paiements"},
    "pay_add_section": {"ar": "إضافة دفعة",                             "fr": "Ajouter paiement"},
    "pay_add_btn":     {"ar": "إضافة دفعة",                             "fr": "Ajouter paiement"},
    "pay_refund":      {"ar": "استرداد",                                "fr": "Remboursement"},
    "pay_print":       {"ar": "طباعة وصل الدفع",                        "fr": "Imprimer reçu"},
    "pay_readonly":    {"ar": "🔒  صلاحية العرض فقط",                   "fr": "🔒  Lecture seule"},
    "pay_date":        {"ar": "التاريخ",         "fr": "Date"},
    "pay_amount":      {"ar": "المبلغ (دج)",     "fr": "Montant (DA)"},
    "pay_method":      {"ar": "الوسيلة",         "fr": "Mode"},
    "pay_note":        {"ar": "ملاحظة",          "fr": "Note"},
    "pay_cand_col":    {"ar": "المترشح",         "fr": "Candidat"},
    "pay_total_col":   {"ar": "الإجمالي (دج)",   "fr": "Total (DA)"},
    "pay_paid_col":    {"ar": "المدفوع (دج)",    "fr": "Payé (DA)"},
    "pay_remain_col":  {"ar": "المتبقي (دج)",    "fr": "Restant (DA)"},
    "pay_search":      {"ar": "ابحث بالاسم:",    "fr": "Rechercher:"},
    # ── المصاريف ─────────────────────────────────────────────────────────────
    "exp_title":       {"ar": "💸  إدارة المصاريف",                       "fr": "💸  Gestion des dépenses"},
    "exp_subtitle":    {"ar": "تسجيل ومتابعة كل المصاريف الشهرية والسنوية","fr": "Suivi de toutes les dépenses"},
    "exp_form":        {"ar": "بيانات المصروف",                            "fr": "Données dépense"},
    "exp_type":        {"ar": "نوع المصروف *",                             "fr": "Type dépense *"},
    "exp_amount":      {"ar": "المبلغ (دج) *",                             "fr": "Montant (DA) *"},
    "exp_date":        {"ar": "التاريخ *",                                 "fr": "Date *"},
    "exp_note":        {"ar": "ملاحظة",                                    "fr": "Note"},
    "exp_col_num":     {"ar": "رقم",              "fr": "N°"},
    "exp_col_type":    {"ar": "نوع المصروف",      "fr": "Type"},
    "exp_col_amount":  {"ar": "المبلغ (دج)",      "fr": "Montant (DA)"},
    "exp_col_date":    {"ar": "التاريخ",          "fr": "Date"},
    "exp_col_note":    {"ar": "ملاحظة",           "fr": "Note"},
    "exp_search":      {"ar": "بحث:",             "fr": "Rechercher:"},
    # ── التقارير ─────────────────────────────────────────────────────────────
    "rep_title":        {"ar": "📊  التقارير والإحصائيات",              "fr": "📊  Rapports et statistiques"},
    "rep_subtitle":     {"ar": "تقارير شهرية وسنوية مفصّلة",           "fr": "Rapports mensuels et annuels détaillés"},
    "rep_filter_lbl":   {"ar": "🗓️  فلترة بالفترة الزمنية  (YYYY-MM-DD)","fr": "🗓️  Filtrer par période (AAAA-MM-JJ)"},
    "rep_from":         {"ar": "من:",              "fr": "De:"},
    "rep_to":           {"ar": "إلى:",             "fr": "À:"},
    "rep_monthly":      {"ar": "تفصيل شهري للسنة المحددة", "fr": "Détail mensuel"},
    "rep_col_month":    {"ar": "الشهر",            "fr": "Mois"},
    "rep_col_pay":      {"ar": "المدفوعات (دج)",   "fr": "Paiements (DA)"},
    "rep_col_exp":      {"ar": "المصاريف (دج)",    "fr": "Dépenses (DA)"},
    "rep_col_profit":   {"ar": "الأرباح (دج)",     "fr": "Bénéfices (DA)"},
    "rep_exam_stats":   {"ar": "إحصائيات نتائج الامتحانات", "fr": "Statistiques examens"},
    "rep_chart_lbl":    {"ar": "مخطط النجاح الشهري  (🟦 نظري ناجح  |  🟩 تطبيقي ناجح  |  ◻ محاولات)",
                         "fr": "Graphique réussite  (🟦 Théo. réussi  |  🟩 Prat. réussi  |  ◻ Tentatives)"},
    "rep_col_nazari_t": {"ar": "نظري (محاولات)", "fr": "Théo. (tentatives)"},
    "rep_col_nazari_p": {"ar": "نظري (ناجح)",    "fr": "Théo. (réussi)"},
    "rep_col_tatbiqi_t":{"ar": "تطبيقي (محاولات)","fr": "Prat. (tentatives)"},
    "rep_col_tatbiqi_p":{"ar": "تطبيقي (ناجح)",  "fr": "Prat. (réussi)"},
    "rep_total_pay":    {"ar": "إجمالي المدفوعات", "fr": "Total paiements"},
    "rep_total_exp":    {"ar": "إجمالي المصاريف",  "fr": "Total dépenses"},
    "rep_net_profit":   {"ar": "صافي الربح",       "fr": "Bénéfice net"},
    "rep_period_cand":  {"ar": "مترشحو الفترة",   "fr": "Candidats période"},
    "rep_no_data":      {"ar": "لا توجد بيانات في هذه الفترة", "fr": "Aucune donnée pour cette période"},
    "rep_overall_rate": {"ar": "المعدل الكلي للنجاح", "fr": "Taux de réussite global"},
    "rep_pass_rate_of": {"ar": "نجاح",              "fr": "Réussite"},
    # ── المترشحون (رسائل إضافية) ─────────────────────────────────────────────
    "cand_added":       {"ar": "تم إضافة المترشح بنجاح",    "fr": "Candidat ajouté avec succès"},
    "cand_updated":     {"ar": "تم تعديل بيانات المترشح",   "fr": "Candidat modifié avec succès"},
    "cand_deleted":     {"ar": "تم حذف المترشح",             "fr": "Candidat supprimé"},
    "cand_sel_first":   {"ar": "يرجى تحديد مترشح من القائمة","fr": "Sélectionnez un candidat d'abord"},
    "cand_del_confirm": {"ar": "هذا المترشح وكل بياناته",   "fr": "ce candidat et toutes ses données"},
    # ── المدفوعات (رسائل إضافية) ─────────────────────────────────────────────
    "pay_err_print":    {"ar": "حدث خطأ أثناء طباعة الوصل",  "fr": "Erreur lors de l'impression du reçu"},
    "pay_err_amount":   {"ar": "يرجى إدخال مبلغ صحيح أكبر من الصفر", "fr": "Veuillez saisir un montant valide supérieur à zéro"},
    "pay_refunded":     {"ar": "تم استرداد المبلغ بنجاح",    "fr": "Remboursement effectué avec succès"},
    "pay_deleted":      {"ar": "تم حذف الدفعة",              "fr": "Paiement supprimé"},
    "pay_sel_first":    {"ar": "يرجى تحديد دفعة من السجل",  "fr": "Sélectionnez un paiement d'abord"},
    "pay_del_confirm":  {"ar": "هذه الدفعة",                 "fr": "ce paiement"},
    # ── المصاريف (رسائل إضافية) ──────────────────────────────────────────────
    "exp_err_type":     {"ar": "يرجى إدخال نوع المصروف",    "fr": "Veuillez saisir le type de dépense"},
    "exp_err_amount":   {"ar": "يرجى إدخال مبلغ صحيح",      "fr": "Veuillez saisir un montant valide"},
    "exp_added":        {"ar": "تم إضافة المصروف بنجاح",    "fr": "Dépense ajoutée avec succès"},
    "exp_updated":      {"ar": "تم تعديل المصروف",           "fr": "Dépense modifiée"},
    "exp_deleted":      {"ar": "تم حذف المصروف",             "fr": "Dépense supprimée"},
    "exp_sel_first":    {"ar": "يرجى تحديد مصروف من القائمة","fr": "Sélectionnez une dépense d'abord"},
    "exp_del_confirm":  {"ar": "هذا المصروف",                "fr": "cette dépense"},
    # ── الممرنون (رسائل إضافية) ──────────────────────────────────────────────
    "inst_del_confirm": {"ar": "هذا الممرن",                 "fr": "ce moniteur"},
    "inst_deleted":     {"ar": "تم حذف الممرن",              "fr": "Moniteur supprimé"},
    # ── نتائج المترشح (حوار) ─────────────────────────────────────────────────
    "cand_exam_sel_first":  {"ar": "يرجى تحديد نتيجة من الجدول",    "fr": "Sélectionnez un résultat d'abord"},
    "cand_exam_del_confirm":{"ar": "هذه النتيجة",                    "fr": "ce résultat"},
    "cand_exam_deleted":    {"ar": "تم حذف النتيجة",                 "fr": "Résultat supprimé"},
    "cand_err_name":        {"ar": "الاسم واللقب إلزاميان",          "fr": "Le nom et le prénom sont obligatoires"},
    "cand_err_license":     {"ar": "يرجى تحديد نوع الرخصة المطلوبة","fr": "Veuillez choisir le type de permis"},
    "cand_err_age_b_reg":   {"ar": "صنف ب يشترط 17 سنة على الأقل للتسجيل",
                             "fr": "Catégorie B requiert 17 ans minimum pour l'inscription"},
    "cand_err_age_c1_reg":  {"ar": "صنف ج1 (C1) يشترط 23 سنة على الأقل للتسجيل",
                             "fr": "Catégorie C1 requiert 23 ans minimum pour l'inscription"},
    "cand_err_age_cde_reg": {"ar": "أصناف ج/د/هـ (C/D/E) تشترط 25 سنة على الأقل للتسجيل",
                             "fr": "Catégories C/D/E requièrent 25 ans minimum pour l'inscription"},
    "train_err_age_circuit":{"ar": "يجب بلوغ 18 سنة كاملة لاجتياز مرحلة السيركوي",
                             "fr": "18 ans révolus requis pour l'épreuve circuit"},
    "cand_err_age_a1_reg":  {"ar": "صنف A1 يشترط 16 سنة على الأقل للتسجيل",
                             "fr": "Catégorie A1 requiert 16 ans minimum pour l'inscription"},
    "cand_err_age_af_reg":  {"ar": "صنفا A وF يشترطان 17 سنة على الأقل للتسجيل",
                             "fr": "Catégories A/F requièrent 17 ans minimum pour l'inscription"},
    "train_err_a1_code_only":{"ar": "صنف A1: يُسمح بمرحلة الكود فقط",
                              "fr": "Cat. A1 : épreuve code uniquement"},
    # ── التكوين ──────────────────────────────────────────────────────────────
    "train_sel_first":  {"ar": "الرجاء تحديد سجل لحذفه",    "fr": "Veuillez sélectionner un enregistrement"},
    "train_del_confirm":{"ar": "هذه النتيجة",                "fr": "ce résultat"},
    "train_deleted":    {"ar": "تم حذف نتيجة الامتحان.",     "fr": "Résultat supprimé."},
    # ── الجدول الزمني (رسائل إضافية) ────────────────────────────────────────
    "sched_sel_first":  {"ar": "يرجى تحديد حصة من الجدول أولاً", "fr": "Sélectionnez une séance d'abord"},
    "sched_del_q":      {"ar": "هل تريد حذف الحصة:",          "fr": "Voulez-vous supprimer la séance:"},
    "sched_deleted":    {"ar": "تم حذف الحصة بنجاح",          "fr": "Séance supprimée"},
    # ── المدفوعات (رسائل إضافية 2) ───────────────────────────────────────────
    "pay_added_print_q":{"ar": "تم تسجيل الدفعة بنجاح!\nهل ترغب في طباعة وصل دفع الآن؟",
                         "fr": "Paiement enregistré!\nVoulez-vous imprimer le reçu maintenant?"},
    "pay_err_amount_num":{"ar": "المبلغ يجب أن يكون رقماً", "fr": "Le montant doit être un nombre"},
    # ── نتائج الامتحانات (مترشح) ──────────────────────────────────────────────
    "cand_exam_added":      {"ar": "تمت إضافة النتيجة بنجاح",       "fr": "Résultat ajouté avec succès"},
    "cand_warn_born_abroad":{"ar": "حدّدت أن المترشح مولود بالخارج لكن لم تُدخل السفارة/القنصلية.\nهل تريد المتابعة؟",
                             "fr": "Le candidat est né à l'étranger mais l'ambassade/consulat n'est pas renseigné.\nContinuer quand même?"},
    # ── التكوين (رسائل إضافية) ───────────────────────────────────────────────
    "train_err_score":   {"ar": "العلامة يجب أن تكون رقماً",        "fr": "La note doit être un nombre"},
    "train_result_saved":{"ar": "تم تسجيل نتيجة الامتحان بنجاح!",  "fr": "Résultat enregistré avec succès!"},
    "train_pass_recorded":{"ar": "تم تسجيل النجاح والمرور للمرحلة التالية بنجاح!",
                           "fr": "Réussite enregistrée et passage à l'étape suivante!"},
    "train_fail_recorded":{"ar": "تم تسجيل الرسوب. تمت إضافة محاولة جديدة للمترشح.",
                           "fr": "Échec enregistré. Une nouvelle tentative a été ajoutée."},
    "train_locked_pass": {"ar": "لا يمكن تسجيل النجاح — يجب النجاح في",
                          "fr": "Impossible de valider — réussir d'abord:"},
    "train_locked_fail": {"ar": "لا يمكن تسجيل الرسوب — يجب النجاح في",
                          "fr": "Impossible d'enregistrer l'échec — réussir d'abord:"},
    # ── نتائج الامتحانات في حوار المترشح ─────────────────────────────────────
    "exam_err_type_result":{"ar": "نوع الامتحان والنتيجة إلزاميان", "fr": "Le type d'examen et le résultat sont obligatoires"},
    # ── الجدول الزمني (رسائل إضافية) ─────────────────────────────────────────
    "sched_err_required":{"ar": "يرجى ملء جميع الحقول الإلزامية (*)", "fr": "Veuillez remplir tous les champs obligatoires (*)"},
    "sched_err_cand":    {"ar": "يرجى اختيار مترشح صحيح من القائمة", "fr": "Sélectionnez un candidat valide"},
    "sched_err_inst":    {"ar": "يرجى اختيار ممرّن صحيح من القائمة", "fr": "Sélectionnez un moniteur valide"},
    "sched_err_time":    {"ar": "صيغة الوقت غير صحيحة، اختر من القائمة (HH:MM)", "fr": "Format d'heure invalide (HH:MM)"},
    "sched_err_duration":{"ar": "المدة يجب أن تكون رقماً موجباً (دقائق) لا تتجاوز 480",
                          "fr": "La durée doit être un entier positif (minutes, max 480)"},
    "sched_conflict":    {"ar": "تعارض في الجدول",                  "fr": "Conflit d'horaire"},
    "sched_conflict_date":{"ar": "بتاريخ",                          "fr": "à la date"},
    "sched_conflict_q":  {"ar": "هل تريد الحفظ رغم التعارض؟",      "fr": "Enregistrer malgré le conflit?"},
    # ── عام ──────────────────────────────────────────────────────────────────
    "err_date_format":   {"ar": "صيغة التاريخ غير صحيحة. استخدم: YYYY-MM-DD",
                          "fr": "Format de date invalide. Utilisez: YYYY-MM-DD"},
    # ── الوثائق (رسائل إضافية) ───────────────────────────────────────────────
    "doc_err_reportlab": {"ar": "مكتبة reportlab غير مثبتة.\nشغّل: pip install reportlab",
                          "fr": "La bibliothèque reportlab n'est pas installée.\nLancez: pip install reportlab"},
    "doc_err_no_cands":  {"ar": "لا يوجد مترشحون في القاعدة",       "fr": "Aucun candidat dans la base"},
    "doc_err_sel_one":   {"ar": "يرجى تحديد مترشح واحد على الأقل", "fr": "Sélectionnez au moins un candidat"},
    # ── إدارة المستخدمين (رسائل إضافية) ──────────────────────────────────────
    "users_err_del_admin":{"ar": "لا يمكن حذف حساب midanic.",         "fr": "Impossible de supprimer le compte midanic."},
    "users_err_del_self": {"ar": "لا يمكنك حذف حسابك الخاص.",       "fr": "Vous ne pouvez pas supprimer votre propre compte."},
    # ── حوار المترشح (tabs / sections / fields / buttons) ────────────────────
    "cdlg_title_add":    {"ar": "➕  تسجيل مترشح جديد",        "fr": "➕  Nouveau candidat"},
    "cdlg_title_edit":   {"ar": "✏️  تعديل بيانات المترشح",    "fr": "✏️  Modifier le candidat"},
    "cdlg_subtitle":     {"ar": "استمارة الترشح لاجتياز امتحانات رخصة السياقة",
                          "fr": "Formulaire de candidature aux examens du permis de conduire"},
    "cdlg_btn_cancel":   {"ar": "إلغاء",                       "fr": "Annuler"},
    "cdlg_btn_save_add": {"ar": "✅  تسجيل المترشح",           "fr": "✅  Enregistrer"},
    "cdlg_btn_save_edit":{"ar": "💾  حفظ التعديل",             "fr": "💾  Enregistrer"},
    "cdlg_tab_personal": {"ar": "👤  البيانات الشخصية",        "fr": "👤  Données personnelles"},
    "cdlg_tab_birth":    {"ar": "🎂  الميلاد والعنوان",        "fr": "🎂  Naissance & adresse"},
    "cdlg_tab_reg":      {"ar": "🚗  التسجيل والتكوين",        "fr": "🚗  Inscription & formation"},
    "cdlg_tab_exams":    {"ar": "📊  نتائج الامتحانات",        "fr": "📊  Résultats d'examens"},
    "cdlg_sec_file":     {"ar": "بيانات الملف",                "fr": "Données du dossier"},
    "cdlg_sec_personal": {"ar": "المعلومات الشخصية",           "fr": "Informations personnelles"},
    "cdlg_sec_birth":    {"ar": "تاريخ ومكان الميلاد",         "fr": "Date et lieu de naissance"},
    "cdlg_sec_addr":     {"ar": "العنوان الحالي",              "fr": "Adresse actuelle"},
    "cdlg_sec_license":  {"ar": "الصنف المطلوب ونوع الرخصة",  "fr": "Catégorie et type de permis"},
    "cdlg_sec_inst_pay": {"ar": "الممرن والمبالغ المالية",     "fr": "Moniteur et montants"},
    "cdlg_sec_prev_lic": {"ar": "الأصناف المتحصل عليها من قبل","fr": "Catégories déjà obtenues"},
    "cdlg_sec_exam_hist":{"ar": "سجل الامتحانات",              "fr": "Historique des examens"},
    "cdlg_f_file_num":   {"ar": "رقم الملف",                  "fr": "N° dossier"},
    "cdlg_f_file_date":  {"ar": "تاريخ إيداع الملف",          "fr": "Date de dépôt"},
    "cdlg_f_lastname":   {"ar": "اللقب (بالعربية) *",          "fr": "Nom (en arabe) *"},
    "cdlg_f_firstname":  {"ar": "الاسم (بالعربية) *",         "fr": "Prénom (en arabe) *"},
    "cdlg_f_lastname_fr":  {"ar": "اللقب (بالفرنسية)",        "fr": "Nom (en français)"},
    "cdlg_f_firstname_fr": {"ar": "الاسم (بالفرنسية)",        "fr": "Prénom (en français)"},
    "cdlg_f_gender":     {"ar": "الجنس",                      "fr": "Sexe"},
    "cdlg_f_marital":    {"ar": "الحالة العائلية",            "fr": "Situation familiale"},
    "cdlg_f_nin":        {"ar": "رقم التعريف الوطني (NIN)",   "fr": "NIN"},
    "cdlg_f_blood":      {"ar": "فصيلة الدم",                 "fr": "Groupe sanguin"},
    "cdlg_f_father":     {"ar": "اسم الأب",                   "fr": "Prénom du père"},
    "cdlg_f_mother":     {"ar": "اسم ولقب الأم",              "fr": "Nom & prénom de la mère"},
    "cdlg_f_phone":      {"ar": "رقم الهاتف",                 "fr": "Téléphone"},
    "cdlg_f_nat":        {"ar": "الجنسية الأصلية",            "fr": "Nationalité d'origine"},
    "cdlg_f_nat2":       {"ar": "الجنسية المكتسبة (إن وجدت)", "fr": "Nationalité acquise (si applicable)"},
    "cdlg_f_disab":      {"ar": "إعاقة / إصابة (إن وجدت)",   "fr": "Handicap / blessure (si applicable)"},
    "cdlg_f_bdate":      {"ar": "تاريخ الميلاد (YYYY-MM-DD)", "fr": "Date de naissance (YYYY-MM-DD)"},
    "cdlg_f_bcountry":   {"ar": "بلد الميلاد",                "fr": "Pays de naissance"},
    "cdlg_f_bcommune":   {"ar": "بلدية / مدينة الميلاد",     "fr": "Commune de naissance"},
    "cdlg_f_bwilaya":    {"ar": "ولاية الميلاد",              "fr": "Wilaya de naissance"},
    "cdlg_f_embassy":    {"ar": "السفارة (للمولودين بالخارج)","fr": "Ambassade (nés à l'étranger)"},
    "cdlg_f_consulate":  {"ar": "القنصلية أو مكتب التسجيل",  "fr": "Consulat ou bureau d'enregistrement"},
    "cdlg_f_acommune":   {"ar": "بلدية / مدينة السكن",       "fr": "Commune de résidence"},
    "cdlg_f_awilaya":    {"ar": "ولاية السكن",                "fr": "Wilaya de résidence"},
    "cdlg_f_addr":       {"ar": "العنوان الكامل (الشارع، الحي...)","fr": "Adresse complète (rue, quartier...)"},
    "cdlg_f_lic_type":   {"ar": "🎯  نوع الرخصة المطلوبة *", "fr": "🎯  Type de permis demandé *"},
    "cdlg_f_lic_hint":   {"ar": "A1: دراجة صغيرة  |  A: دراجة نارية  |  B: سيارة  |  C1/C: شاحنة  |  D: حافلة  |  E: مقطورة  |  F: خاص",
                          "fr": "A1: Moto légère  |  A: Moto  |  B: Voiture  |  C1/C: Camion  |  D: Bus  |  E: Remorque  |  F: Spécial"},
    "cdlg_f_inst":       {"ar": "الممرن المُكلَّف",           "fr": "Moniteur assigné"},
    "cdlg_f_total_amt":  {"ar": "المبلغ الإجمالي للتكوين (دج) *","fr": "Montant total formation (DA) *"},
    "cdlg_f_init_pay":   {"ar": "المبلغ المدفوع عند التسجيل (دج)","fr": "Acompte à l'inscription (DA)"},
    "cdlg_f_prev_lic":   {"ar": "الأصناف السابقة (مثال: A, B, C1)","fr": "Catégories précédentes (ex: A, B, C1)"},
    "cdlg_f_prev_hint":  {"ar": "أدخل رموز الأصناف القديمة مفصولة بفاصلة — مثال:  B, A1, C1",
                          "fr": "Saisissez les catégories séparées par des virgules — ex: B, A1, C1"},
    "cdlg_born_abroad":  {"ar": "  مولود(ة) بالخارج — تفعيل حقول بلد الميلاد والسفارة/القنصلية",
                          "fr": "  Né(e) à l'étranger — activer les champs pays/ambassade/consulat"},
    "cdlg_save_first":   {"ar": "احفظ بيانات المترشح أولاً، ثم ارجع لهذا التبويب لإضافة نتائج الامتحانات.",
                          "fr": "Enregistrez d'abord le candidat, puis revenez dans cet onglet pour ajouter des résultats."},
    "cdlg_btn_add_res":  {"ar": "إضافة نتيجة",               "fr": "Ajouter résultat"},
    "cdlg_btn_del_res":  {"ar": "حذف المحدد",                "fr": "Supprimer sélectionné"},
    "cdlg_exam_card":    {"ar": "امتحان",                     "fr": "Examen"},
    "cdlg_exam_pct":     {"ar": "ناجح",                      "fr": "réussi"},
    "cdlg_exam_tries":   {"ar": "محاولات",                   "fr": "tentatives"},
    # ── حوار الامتحان (ExamResultDialog) ─────────────────────────────────────
    "exdlg_title":       {"ar": "إضافة نتيجة امتحان",         "fr": "Ajouter résultat d'examen"},
    "exdlg_header":      {"ar": "📝  إضافة نتيجة امتحان",     "fr": "📝  Nouveau résultat d'examen"},
    "exdlg_f_type":      {"ar": "نوع الامتحان *",             "fr": "Type d'examen *"},
    "exdlg_f_date":      {"ar": "تاريخ الامتحان (YYYY-MM-DD) *","fr": "Date d'examen (YYYY-MM-DD) *"},
    "exdlg_f_result":    {"ar": "النتيجة *",                  "fr": "Résultat *"},
    "exdlg_f_score":     {"ar": "الدرجة / العلامة (اختياري)","fr": "Note (optionnel)"},
    "exdlg_f_notes":     {"ar": "ملاحظات (اختياري)",          "fr": "Observations (optionnel)"},
    "exdlg_btn_cancel":  {"ar": "إلغاء",                      "fr": "Annuler"},
    "exdlg_btn_save":    {"ar": "✅  حفظ النتيجة",            "fr": "✅  Enregistrer"},
    # ── حوار الممرن (InstructorDialog) ───────────────────────────────────────
    "idlg_win_title":    {"ar": "بيانات الممرن",              "fr": "Données du moniteur"},
    "idlg_title_add":    {"ar": "➕  إضافة ممرن جديد",        "fr": "➕  Nouveau moniteur"},
    "idlg_title_edit":   {"ar": "✏️  تعديل بيانات الممرن",   "fr": "✏️  Modifier le moniteur"},
    "idlg_tab_basic":    {"ar": "👤 البيانات الأساسية",       "fr": "👤 Données de base"},
    "idlg_tab_contract": {"ar": "📜 بيانات العقد",            "fr": "📜 Contrat"},
    "idlg_f_fname":      {"ar": "الاسم *",                    "fr": "Prénom *"},
    "idlg_f_lname":      {"ar": "اللقب *",                    "fr": "Nom *"},
    "idlg_f_bdate":      {"ar": "تاريخ الميلاد",              "fr": "Date de naissance"},
    "idlg_f_bplace":     {"ar": "مكان الميلاد",               "fr": "Lieu de naissance"},
    "idlg_f_phone":      {"ar": "رقم الهاتف",                 "fr": "Téléphone"},
    "idlg_f_addr":       {"ar": "العنوان",                    "fr": "Adresse"},
    "idlg_f_lic_num":    {"ar": "رقم رخصة السياقة",           "fr": "N° permis de conduire"},
    "idlg_f_lic_date":   {"ar": "تاريخ الحصول عليها",         "fr": "Date d'obtention"},
    "idlg_f_cats":       {"ar": "الأصناف (مثال: A,B)",        "fr": "Catégories (ex: A,B)"},
    "idlg_f_exp":        {"ar": "سنوات الخبرة",               "fr": "Années d'expérience"},
    "idlg_f_dur":        {"ar": "مدة العقد (مثلاً: سنة)",     "fr": "Durée du contrat (ex: 1 an)"},
    "idlg_f_salary":     {"ar": "الأجر الشهري (دج)",          "fr": "Salaire mensuel (DA)"},
    "idlg_f_start":      {"ar": "تاريخ بداية العمل",          "fr": "Date de début"},
    "idlg_f_sign":       {"ar": "تاريخ إمضاء العقد",          "fr": "Date de signature"},
    "idlg_f_notice":     {"ar": "مدة الإخطار (بالأشهر)",      "fr": "Préavis (en mois)"},
    "idlg_btn_cancel":   {"ar": "إلغاء",                      "fr": "Annuler"},
    "idlg_btn_save":     {"ar": "حفظ البيانات",               "fr": "Enregistrer"},
    # ── لوحة المعلومات (Dashboard) ───────────────────────────────────────────
    "dash_alerts":       {"ar": "تنبيهات وإشعارات هامة",       "fr": "Alertes et notifications"},
    "dash_veh_alert":    {"ar": "قرب انتهاء التأمين/المراقبة",  "fr": "assurance/contrôle proche expiration"},
    "dash_unpaid":       {"ar": "مترشحين لم يسددوا كامل المستحقات.",
                          "fr": "candidats avec des impayés."},
    "dash_today":        {"ar": "حصص اليوم",                   "fr": "Séances d'aujourd'hui"},
    "dash_no_sess":      {"ar": "لا توجد حصص مجدولة لهذا اليوم","fr": "Aucune séance prévue aujourd'hui"},
    "dash_next_sess":    {"ar": "⏭  أقرب حصة قادمة:",         "fr": "⏭  Prochaine séance:"},
    "dash_recent":       {"ar": "المترشحون المسجلون حديثاً",   "fr": "Candidats récemment inscrits"},
    "dash_view_detail":  {"ar": "← عرض التفاصيل",             "fr": "→ Voir les détails"},
    "dash_col_time":     {"ar": "الوقت",                      "fr": "Heure"},
    "dash_col_cand":     {"ar": "المترشح",                    "fr": "Candidat"},
    "dash_col_inst":     {"ar": "الممرن",                     "fr": "Moniteur"},
    "dash_col_type":     {"ar": "النوع",                      "fr": "Type"},
    "dash_col_dur":      {"ar": "المدة(د)",                   "fr": "Durée(mn)"},
    "dash_col_full":     {"ar": "الاسم الكامل",               "fr": "Nom complet"},
    "dash_col_phone":    {"ar": "الهاتف",                     "fr": "Téléphone"},
    "dash_col_lic":      {"ar": "نوع الرخصة",                 "fr": "Type permis"},
    "dash_col_total":    {"ar": "المبلغ الإجمالي",            "fr": "Montant total"},
    "dash_col_date":     {"ar": "تاريخ التسجيل",              "fr": "Date inscription"},
    "dash_profit_cur":   {"ar": "دج",                         "fr": "DA"},
    "dash_pct_pass":     {"ar": "% ناجح",                     "fr": "% réussite"},
    "dash_tries":        {"ar": "المحاولات",                  "fr": "Tentatives"},
    "dash_pass":         {"ar": "ناجح",                       "fr": "Réussi"},
    "dash_fail":         {"ar": "راسب",                       "fr": "Échec"},
    "dash_there_are":    {"ar": "هناك",                       "fr": "Il y a"},
    "dash_veh_text":     {"ar": "مركبة",                      "fr": "Véhicule"},
    # ── نافذة التدريب (TrainingFrame inline labels) ───────────────────────────
    "train_sec_current":    {"ar": "إدارة المرحلة الحالية",    "fr": "Gestion de l'étape actuelle"},
    "train_choose_cand":    {"ar": "الرجاء اختيار مترشح",      "fr": "Veuillez choisir un candidat"},
    "train_btn_pass":       {"ar": "نجاح",                     "fr": "Réussite"},
    "train_btn_fail":       {"ar": "رسوب",                     "fr": "Échec"},
    "train_search_cand":    {"ar": "ابحث عن مترشح:",           "fr": "Rechercher candidat:"},
    "train_choose_cand_sec":{"ar": "اختر المترشح",             "fr": "Choisir le candidat"},
    "train_hours_info":  {"ar": "الحجم الساعي: 30 ساعة كود | 30 ساعة سياقة",
                          "fr": "Volume horaire: 30h code | 30h conduite"},
    "train_stage_lbl":   {"ar": "المرحلة:",            "fr": "Étape:"},
    "train_status_lbl":  {"ar": "الحالة:",             "fr": "Statut:"},
    "train_stage_init":  {"ar": "المرحلة: -",          "fr": "Étape: -"},
    "train_status_init": {"ar": "الحالة: -",           "fr": "Statut: -"},
    "train_must_pass":   {"ar": "يجب النجاح في",       "fr": "Doit réussir"},
    "train_first":       {"ar": "أولاً",               "fr": "d'abord"},
    "train_locked_lbl":  {"ar": "مقفلة",               "fr": "verrouillée"},
    "train_history_ttl": {"ar": "سجل مراحل التكوين",  "fr": "Historique de formation"},
    "train_history_cand":{"ar": "سجل مراحل التكوين للمترشح:", "fr": "Historique de formation:"},
    "train_exam_ttl":    {"ar": "نتائج الامتحانات",    "fr": "Résultats d'examens"},
    "train_exam_cand":   {"ar": "📋  نتائج الامتحانات للمترشح:", "fr": "📋  Résultats d'examens:"},
    "train_choose_stage":{"ar": "اختر المرحلة:",       "fr": "Choisir étape:"},
    "train_add_result":  {"ar": "تسجيل نتيجة امتحان", "fr": "Ajouter résultat"},
    "train_del_sel":     {"ar": "حذف المحدد",          "fr": "Supprimer sélectionné"},
    "train_exam_new":    {"ar": "تسجيل نتيجة امتحان جديدة", "fr": "Nouveau résultat d'examen"},
    "train_stage_field": {"ar": "المرحلة:",            "fr": "Étape:"},
    "train_date_field":  {"ar": "تاريخ الامتحان:",    "fr": "Date d'examen:"},
    "train_score_field": {"ar": "العلامة (/ 40):",     "fr": "Note (/ 40):"},
    "train_result_field":{"ar": "النتيجة:",            "fr": "Résultat:"},
    "train_notes_field": {"ar": "ملاحظات:",            "fr": "Observations:"},
    "train_btn_save":    {"ar": "حفظ",                 "fr": "Enregistrer"},
    "train_btn_cancel":  {"ar": "إلغاء",               "fr": "Annuler"},
    "train_col_num":     {"ar": "رقم",                 "fr": "N°"},
    "train_col_stage":   {"ar": "المرحلة",             "fr": "Étape"},
    "train_col_status":  {"ar": "الحالة",              "fr": "Statut"},
    "train_col_start":   {"ar": "تاريخ البداية",       "fr": "Date début"},
    "train_col_end":     {"ar": "تاريخ النهاية",       "fr": "Date fin"},
    "train_col_score":   {"ar": "النتيجة",             "fr": "Résultat"},
    "train_col_notes":   {"ar": "ملاحظات",             "fr": "Observations"},
    "train_col_exam_date":{"ar": "تاريخ الامتحان",    "fr": "Date examen"},
    "train_col_score40": {"ar": "العلامة / 40",        "fr": "Note / 40"},
    "train_res_pass":    {"ar": "✅ ناجح",              "fr": "✅ Réussi"},
    "train_res_fail":    {"ar": "❌ راسب",              "fr": "❌ Échoué"},
    # ── مدفوعات (نافذة دفعات المترشح) ────────────────────────────────────────
    "pay_col_num":       {"ar": "رقم",                 "fr": "N°"},
    "pay_col_date2":     {"ar": "التاريخ",             "fr": "Date"},
    "pay_col_amount_da": {"ar": "المبلغ (دج)",         "fr": "Montant (DA)"},
    "pay_col_method2":   {"ar": "طريقة الدفع",         "fr": "Mode de paiement"},
    "pay_col_note2":     {"ar": "ملاحظة",              "fr": "Observation"},
    "pay_btn_del":       {"ar": "حذف الدفعة المحددة", "fr": "Supprimer paiement"},
    "pay_btn_close":     {"ar": "إغلاق",               "fr": "Fermer"},
    # ── عام (section_title, stat_card) ────────────────────────────────────────
    "lbl_this_item":     {"ar": "هذا العنصر",          "fr": "cet élément"},
    # ── الوثائق ──────────────────────────────────────────────────────────────
    "doc_title":         {"ar": "🖨️  طباعة الوثائق بالعربية",                     "fr": "🖨️  Impression des documents"},
    "doc_subtitle":      {"ar": "إنتاج كل الوثائق الرسمية بصيغة PDF بنص عربي مُنسّق","fr": "Produire tous les documents officiels en PDF"},
    "doc_individual":    {"ar": "وثائق فردية (للمترشح المحدد)",                   "fr": "Documents individuels (candidat sélectionné)"},
    "doc_collective":    {"ar": "وثائق جماعية",                                   "fr": "Documents collectifs"},
    "doc_dispatch":      {"ar": "جدول إرسال",              "fr": "Tableau de convoi"},
    "doc_exam_form":     {"ar": "استمارة الترشح الرسمية",  "fr": "Formulaire de candidature"},
    "doc_training_card": {"ar": "بطاقة التكوين",           "fr": "Fiche de formation"},
    "doc_cand_list":     {"ar": "قائمة المترشحين",         "fr": "Liste des candidats"},
    "doc_inst_list":     {"ar": "قائمة الممرنين",          "fr": "Liste des moniteurs"},
    "doc_payments_rep":  {"ar": "تقرير المدفوعات",         "fr": "Rapport paiements"},
    "doc_expenses_rep":  {"ar": "تقرير المصاريف",          "fr": "Rapport dépenses"},
    "doc_contract":      {"ar": "عقد العمل",               "fr": "Contrat de travail"},
    "doc_convoy_all":    {"ar": "جدول الإرسال الكامل",     "fr": "Tableau de convoi complet"},
    # ── الجدول الزمني ────────────────────────────────────────────────────────
    "sched_title":    {"ar": "📅  الجدول الزمني",     "fr": "📅  Planning"},
    "sched_subtitle": {"ar": "جدول حصص التدريب",      "fr": "Planning des séances"},
    "sched_add":      {"ar": "إضافة حصة",             "fr": "Ajouter séance"},
    "sched_edit":     {"ar": "تعديل",                 "fr": "Modifier"},
    "sched_delete":   {"ar": "حذف",                   "fr": "Supprimer"},
    "sched_col_date": {"ar": "التاريخ",               "fr": "Date"},
    "sched_col_time": {"ar": "الوقت",                 "fr": "Heure"},
    "sched_col_cand": {"ar": "المترشح",               "fr": "Candidat"},
    "sched_col_inst": {"ar": "الممرن",                "fr": "Moniteur"},
    "sched_col_type": {"ar": "النوع",                 "fr": "Type"},
    "sched_col_dur":  {"ar": "المدة(د)",              "fr": "Durée(min)"},
    "sched_col_notes":{"ar": "ملاحظات",              "fr": "Notes"},
    "sched_add_title":{"ar": "إضافة حصة جديدة",     "fr": "Nouvelle séance"},
    "sched_edit_title":{"ar": "تعديل حصة تدريبية",  "fr": "Modifier la séance"},
    "sched_btn_add":  {"ar": "إضافة حصة",            "fr": "Ajouter séance"},
    "sched_btn_all":  {"ar": "كل الحصص",             "fr": "Toutes les séances"},
    "sched_filter_date":{"ar": "التاريخ:",           "fr": "Date:"},
    "sched_filter_inst":{"ar": "الممرّن:",           "fr": "Moniteur:"},
    "sched_filter_cand":{"ar": "المترشح:",           "fr": "Candidat:"},
    "sched_lbl_cand": {"ar": "المترشح *",            "fr": "Candidat *"},
    "sched_lbl_inst": {"ar": "الممرّن *",            "fr": "Moniteur *"},
    "sched_lbl_vehicle":{"ar": "المركبة",            "fr": "Véhicule"},
    "sched_lbl_date": {"ar": "التاريخ * (YYYY-MM-DD)","fr": "Date * (YYYY-MM-DD)"},
    "sched_lbl_time": {"ar": "الوقت *",              "fr": "Heure *"},
    "sched_lbl_duration":{"ar": "المدة (دقيقة) *",  "fr": "Durée (min) *"},
    "sched_lbl_type": {"ar": "نوع الحصة",            "fr": "Type de séance"},
    "sched_lbl_notes":{"ar": "ملاحظات",              "fr": "Notes"},
    "sched_no_vehicle":{"ar": "بلا مركبة",           "fr": "Sans véhicule"},
    "sched_week_summary":{"ar": "حصص الأسبوع القادم:", "fr": "Séances semaine:"},
    "sched_today_summary":{"ar": "حصص اليوم:",      "fr": "Séances aujourd'hui:"},
    "sched_conflict_inst":{"ar": "الممرّن لديه حصة في", "fr": "Le moniteur a une séance à"},
    "sched_conflict_veh": {"ar": "المركبة مستخدمة في", "fr": "Le véhicule est occupé à"},
    "sched_conflict_dur": {"ar": "مدة",              "fr": "durée"},
    "filter_all":     {"ar": "الكل",                 "fr": "Tous"},
    "btn_filter":     {"ar": "تصفية",                "fr": "Filtrer"},
    # ── TrainingFrame ─────────────────────────────────────────────────────────
    "train_cand_label":{"ar": "المترشح:",            "fr": "Candidat:"},
    "train_no_stages": {"ar": "لا توجد مراحل",       "fr": "Aucune étape"},
    "train_graduated": {"ar": "🎓 تخرج بنجاح!",      "fr": "🎓 Diplômé!"},
    "train_all_done":  {"ar": "أنهى جميع المراحل (الكود، الكرينو، السيركوي)",
                        "fr": "Toutes les étapes terminées"},
    # ── PaymentsFrame ─────────────────────────────────────────────────────────
    "pay_search_lbl":  {"ar": "بحث:",                "fr": "Rechercher:"},
    "pay_col_id":      {"ar": "رقم",                 "fr": "N°"},
    "pay_col_last":    {"ar": "اللقب",               "fr": "Nom"},
    "pay_col_first":   {"ar": "الاسم",               "fr": "Prénom"},
    "pay_col_phone2":  {"ar": "الهاتف",              "fr": "Tél"},
    "pay_col_total":   {"ar": "المبلغ الإجمالي",     "fr": "Montant total"},
    "pay_lbl_total":   {"ar": "المبلغ الإجمالي:",    "fr": "Total:"},
    "pay_lbl_paid":    {"ar": "المدفوع:",             "fr": "Versé:"},
    "pay_lbl_remaining":{"ar": "المتبقي:",           "fr": "Reste:"},
    "pay_history_title":{"ar": "سجل المدفوعات",      "fr": "Historique des paiements"},
    "pay_history_for": {"ar": "سجل المدفوعات للمترشح:", "fr": "Historique pour:"},
    # ── ReportsFrame ──────────────────────────────────────────────────────────
    "report_no_data":  {"ar": "لا توجد بيانات في هذه الفترة",
                        "fr": "Aucune donnée pour cette période"},
    # ── Document names for _trigger_print ─────────────────────────────────────
    "doc_enroll_form": {"ar": "استمارة الترشح",      "fr": "Formulaire d'inscription"},
    "doc_training_card":{"ar": "بطاقة التكوين",      "fr": "Fiche de formation"},
    "doc_admin_cert":  {"ar": "الشهادة الإدارية",    "fr": "Certificat administratif"},
    "doc_payment_receipt":{"ar": "وصل الدفع",        "fr": "Reçu de paiement"},
    "doc_cand_list":   {"ar": "قائمة المترشحين",     "fr": "Liste des candidats"},
    "doc_inst_list":   {"ar": "قائمة الممرنين",      "fr": "Liste des moniteurs"},
    "doc_expenses":    {"ar": "تقرير المصاريف",       "fr": "Rapport des dépenses"},
    "doc_payments_report":{"ar": "تقرير المدفوعات",  "fr": "Rapport des paiements"},
    "doc_exam_cand_list":{"ar": "قائمة المترشحين للامتحان", "fr": "Liste candidats examen"},
    # ── Dispatch dialog ───────────────────────────────────────────────────────
    "dispatch_dlg_title":{"ar": "إعداد جدول الإرسال",
                          "fr": "Préparer tableau de convoi"},
    "dispatch_dlg_head":{"ar": "إعداد جدول الإرسال — اختر المترشحين",
                         "fr": "Tableau de convoi — Choisir les candidats"},
    "dispatch_doc_settings":{"ar": "إعدادات الوثيقة","fr": "Paramètres du document"},
    "dispatch_lbl_date":{"ar": "التاريخ",             "fr": "Date"},
    "dispatch_lbl_record_no":{"ar": "رقم المحضر",    "fr": "N° procès-verbal"},
    "dispatch_lbl_wilaya":{"ar": "مكان الإرسال (الولاية)", "fr": "Wilaya de convoi"},
    "dispatch_sort_title":{"ar": "ترتيب المترشحين",     "fr": "Ordre des candidats"},
    "dispatch_sort_default":{"ar": "الترتيب الافتراضي", "fr": "Ordre par défaut"},
    "dispatch_sort_alpha":{"ar": "أبجدياً (اللقب)",     "fr": "Alphabétique (nom)"},
    "dispatch_sort_birth":{"ar": "حسب تاريخ الميلاد",  "fr": "Par date de naissance"},
    "dispatch_sort_reg":  {"ar": "حسب تاريخ التسجيل",  "fr": "Par date d'inscription"},
    "dispatch_choose_cands":{"ar": "اختر المترشحين", "fr": "Choisir les candidats"},
    "dispatch_select_all":{"ar": "✓ تحديد الكل",     "fr": "✓ Sélectionner tout"},
    "dispatch_deselect_all":{"ar": "✗ إلغاء الكل",  "fr": "✗ Désélectionner"},
    "dispatch_click_hint":{"ar": "اضغط على أي صف لتحديده / إلغاء تحديده",
                           "fr": "Cliquez pour sélectionner/désélectionner"},
    "dispatch_col_num":{"ar": "رقم",                  "fr": "N°"},
    "dispatch_col_name":{"ar": "اللقب والاسم",        "fr": "Nom et prénom"},
    "dispatch_col_lic": {"ar": "الصنف",               "fr": "Catégorie"},
    "dispatch_col_birth":{"ar": "تاريخ الميلاد",     "fr": "Date naissance"},
    "dispatch_print_direct":{"ar": "طباعة مباشرة",   "fr": "Impression directe"},
    "dispatch_gen_pdf": {"ar": "توليد PDF",           "fr": "Générer PDF"},
    # ── Exam list dialog ──────────────────────────────────────────────────────
    "examlist_dlg_title":{"ar": "إعداد قائمة المترشحين للامتحان",
                          "fr": "Préparer liste candidats examen"},
    "examlist_dlg_head":{"ar": "إعداد قائمة المترشحين لنيل رخصة السياقة",
                         "fr": "Liste candidats pour permis de conduire"},
    "examlist_exam_data":{"ar": "بيانات الامتحان",   "fr": "Données de l'examen"},
    "examlist_exam_date":{"ar": "تاريخ الامتحان",    "fr": "Date d'examen"},
    "examlist_exam_center":{"ar": "مركز الامتحان",   "fr": "Centre d'examen"},
    "examlist_doc_ref": {"ar": "رقم التسجيل",          "fr": "N° immatriculation"},
    "examlist_wilaya":  {"ar": "الولاية",             "fr": "Wilaya"},
    "examlist_nature":  {"ar": "طبيعة الامتحان",      "fr": "Nature de l'examen"},
    "examlist_all_types":{"ar": "كل الأنواع",         "fr": "Tous les types"},
    "examlist_code":    {"ar": "قانون المرور (كود)",  "fr": "Code de la route"},
    "examlist_creneau": {"ar": "المناورات (كرينو)",   "fr": "Manœuvres (créneau)"},
    "examlist_circuit": {"ar": "السياقة (طريق)",      "fr": "Conduite (circuit)"},
    "examlist_gen_pdf": {"ar": "توليد الوثيقة PDF",   "fr": "Générer le document PDF"},
    # ── Currency & HTML Receipt ───────────────────────────────────────────────
    "currency_unit":     {"ar": "دج",                       "fr": "DA"},
    "receipt_title":     {"ar": "وصل دفع",                  "fr": "Reçu de paiement"},
    "receipt_address_lbl":{"ar": "العنوان",                 "fr": "Adresse"},
    "receipt_phone_lbl": {"ar": "الهاتف",                   "fr": "Tél"},
    "receipt_cand_lbl":  {"ar": "المترشح",                  "fr": "Candidat"},
    "receipt_cand_phone":{"ar": "رقم الهاتف",               "fr": "Tél"},
    "receipt_col_num":   {"ar": "رقم",                      "fr": "N°"},
    "receipt_col_date":  {"ar": "التاريخ",                  "fr": "Date"},
    "receipt_col_amount":{"ar": "المبلغ",                   "fr": "Montant"},
    "receipt_col_method":{"ar": "طريقة الدفع",              "fr": "Mode de paiement"},
    "receipt_col_note":  {"ar": "ملاحظة",                   "fr": "Note"},
    "receipt_sum_total": {"ar": "المبلغ الإجمالي للتكوين",  "fr": "Montant total formation"},
    "receipt_sum_paid":  {"ar": "مجموع المدفوعات",          "fr": "Total versé"},
    "receipt_sum_remaining":{"ar": "المبلغ المتبقي",        "fr": "Reste à payer"},
    "receipt_issued":    {"ar": "حُرّر بتاريخ",             "fr": "Établi le"},
    "receipt_signature": {"ar": "ختم وتوقيع المسؤول",       "fr": "Cachet et signature du responsable"},
    # ── Payment misc ──────────────────────────────────────────────────────────
    "pay_refund_note":   {"ar": "استرداد مبلغ",             "fr": "Remboursement"},
    # ── DocumentsFrame library warnings ───────────────────────────────────────
    "doc_warn_reportlab":{"ar": "⚠️  مكتبة reportlab غير مثبتة. شغّل: pip install reportlab",
                          "fr": "⚠️  Bibliothèque reportlab manquante. Exécuter: pip install reportlab"},
    "doc_warn_arabic_libs":{"ar": "⚠️  مكتبتا arabic_reshaper و python-bidi غير مثبتتين.\nقد تظهر الحروف العربية متفرقة. شغّل:\n   pip install arabic_reshaper python-bidi",
                            "fr": "⚠️  Bibliothèques arabic_reshaper / python-bidi manquantes.\nExécuter: pip install arabic_reshaper python-bidi"},
    "doc_ok_arabic":     {"ar": "✓  دعم العربية مفعّل",    "fr": "✓  Support arabe activé"},
    # ── تسجيل الدخول ────────────────────────────────────────────────────────
    "login_title":     {"ar": "تسجيل الدخول — برنامج ميدانيك", "fr": "Connexion — Meidanic"},
    "login_app_sub":   {"ar": "إدارة مدرسة تعليم السياقة — الجزائر", "fr": "Gestion auto-école — Algérie"},
    "login_heading":   {"ar": "تسجيل الدخول",       "fr": "Connexion"},
    "login_username":  {"ar": "اسم المستخدم",        "fr": "Nom d'utilisateur"},
    "login_password":  {"ar": "كلمة المرور",         "fr": "Mot de passe"},
    "login_btn":       {"ar": "  ←  دخول",           "fr": "  →  Se connecter"},
    "login_hint":      {"ar": "🔑  الحساب الافتراضي للمدير:  midanic  /  admin123",
                         "fr": "🔑  Compte admin par défaut:  midanic  /  admin123"},
    "login_err_empty": {"ar": "يرجى إدخال اسم المستخدم وكلمة المرور",
                         "fr": "Veuillez saisir le nom d'utilisateur et le mot de passe"},
    "login_err_bad":   {"ar": "❌  اسم المستخدم أو كلمة المرور غير صحيحة",
                         "fr": "❌  Nom d'utilisateur ou mot de passe incorrect"},
    # ── المستخدمون ───────────────────────────────────────────────────────────
    "user_title":       {"ar": "👥  إدارة المستخدمين والصلاحيات", "fr": "👥  Gestion des utilisateurs"},
    "user_new":         {"ar": "مستخدم جديد",         "fr": "Nouvel utilisateur"},
    "user_edit_perms":  {"ar": "تعديل الصلاحيات",    "fr": "Modifier permissions"},
    "user_change_pass": {"ar": "تغيير كلمة المرور",  "fr": "Changer mot de passe"},
    "user_delete":      {"ar": "حذف المستخدم",        "fr": "Supprimer utilisateur"},
    "user_col_user":    {"ar": "اسم المستخدم",        "fr": "Utilisateur"},
    "user_col_name":    {"ar": "الاسم الكامل",        "fr": "Nom complet"},
    "user_col_role":    {"ar": "الدور",               "fr": "Rôle"},
    "user_col_perms":   {"ar": "الصلاحيات الممنوحة", "fr": "Permissions"},
    "user_role_admin":  {"ar": "مدير",                "fr": "Administrateur"},
    "user_role_trainer":{"ar": "ممرّن",               "fr": "Moniteur"},
    "user_all_perms":   {"ar": "جميع الصلاحيات",     "fr": "Toutes permissions"},
    "user_no_perms":    {"ar": "—  لا صلاحيات",      "fr": "—  Aucune permission"},
    # aliases for UserManagementDialog (uses users_ prefix)
    "users_title":        {"ar": "إدارة المستخدمين",                   "fr": "Gestion des utilisateurs"},
    "users_header":       {"ar": "👥  إدارة المستخدمين والصلاحيات",    "fr": "👥  Gestion utilisateurs et permissions"},
    "users_new":          {"ar": "مستخدم جديد",                        "fr": "Nouvel utilisateur"},
    "users_edit":         {"ar": "تعديل الصلاحيات",                    "fr": "Modifier permissions"},
    "users_change_pass":  {"ar": "تغيير كلمة المرور",                  "fr": "Changer mot de passe"},
    "users_delete":       {"ar": "حذف المستخدم",                       "fr": "Supprimer utilisateur"},
    "users_col_uname":    {"ar": "اسم المستخدم",                       "fr": "Utilisateur"},
    "users_col_fullname": {"ar": "الاسم الكامل",                       "fr": "Nom complet"},
    "users_col_role":     {"ar": "الدور",                              "fr": "Rôle"},
    "users_col_perms":    {"ar": "الصلاحيات الممنوحة",                 "fr": "Permissions"},
    "users_role_admin":   {"ar": "مدير",                               "fr": "Administrateur"},
    "users_role_inst":    {"ar": "ممرّن",                              "fr": "Moniteur"},
    "users_all_perms":    {"ar": "جميع الصلاحيات",                     "fr": "Toutes permissions"},
    "users_no_perms":     {"ar": "—  لا صلاحيات",                      "fr": "—  Aucune permission"},
    "user_fullname_f":  {"ar": "الاسم الكامل:",       "fr": "Nom complet:"},
    "user_username_f":  {"ar": "اسم المستخدم:",      "fr": "Nom d'utilisateur:"},
    "user_pass_f":      {"ar": "كلمة المرور:",        "fr": "Mot de passe:"},
    "user_perms_f":     {"ar": "  الصلاحيات  ",      "fr": "  Permissions  "},
    "user_admin_info":  {"ar": "حساب المدير يملك دائماً جميع الصلاحيات.",
                          "fr": "Le compte admin a toujours toutes les permissions."},
    "user_sys_admin":   {"ar": "مدير النظام",         "fr": "Admin système"},
    "user_new_title":   {"ar": "مستخدم جديد",         "fr": "Nouvel utilisateur"},
    "user_edit_title":  {"ar": "تعديل الصلاحيات",    "fr": "Modifier permissions"},
    "user_save_btn":    {"ar": "حفظ",                 "fr": "Enregistrer"},
    "user_save_pass":   {"ar": "حفظ كلمة المرور",    "fr": "Enregistrer le mot de passe"},
    "user_new_pass_f":  {"ar": "كلمة المرور الجديدة:","fr": "Nouveau mot de passe:"},
    "user_conf_pass_f": {"ar": "تأكيد كلمة المرور:", "fr": "Confirmer le mot de passe:"},
    "user_chg_pwd_ttl": {"ar": "🔑  تغيير كلمة المرور","fr": "🔑  Changer mot de passe"},
    "user_warn_no_usr": {"ar": "أدخل اسم المستخدم",  "fr": "Entrez le nom d'utilisateur"},
    "user_warn_no_pwd": {"ar": "أدخل كلمة المرور",   "fr": "Entrez le mot de passe"},
    "user_warn_no_newpwd":{"ar": "أدخل كلمة المرور الجديدة","fr": "Entrez le nouveau mot de passe"},
    "user_warn_mismatch":{"ar": "كلمتا المرور غير متطابقتين","fr": "Les mots de passe ne correspondent pas"},
    "user_warn_short":  {"ar": "كلمة المرور يجب أن تكون 4 أحرف على الأقل",
                          "fr": "Le mot de passe doit contenir au moins 4 caractères"},
    "user_pwd_done":    {"ar": "تم تغيير كلمة المرور بنجاح","fr": "Mot de passe modifié avec succès"},
    "user_done_ttl":    {"ar": "تم",                  "fr": "Terminé"},
    # ── أعمدة قائمة المترشحين (aliases) ───────────────────────────────────────
    "cand_col_last":    {"ar": "اللقب",               "fr": "Nom"},
    "cand_col_first":   {"ar": "الاسم",               "fr": "Prénom"},
    "cand_col_lic":     {"ar": "نوع الرخصة",          "fr": "Type permis"},
    "cand_col_notes":   {"ar": "ملاحظات",             "fr": "Observations"},
    # ── عنوان التطبيق والعلامة التجارية ─────────────────────────────────────
    "app_title":        {"ar": "برنامج ميدانيك — إدارة مدرسة تعليم السياقة",
                          "fr": "Meidanic — Gestion auto-école"},
    "brand_name":       {"ar": "ميدانيك",             "fr": "Meidanic"},
    # ── نافذة الطباعة ────────────────────────────────────────────────────────
    "print_dlg_title":  {"ar": "اختيار الطابعة",      "fr": "Sélectionner imprimante"},
    "print_label":      {"ar": "🖨️  طباعة:",          "fr": "🖨️  Impression:"},
    "print_choose":     {"ar": "اختر الطابعة:",       "fr": "Choisir l'imprimante:"},
    "print_btn":        {"ar": "طباعة",               "fr": "Imprimer"},
    "print_open":       {"ar": "فتح الملف فقط",       "fr": "Ouvrir seulement"},
    "print_cancel":     {"ar": "إلغاء",               "fr": "Annuler"},
    "print_default":    {"ar": "الطابعة الافتراضية",  "fr": "Imprimante par défaut"},
    "print_sent":       {"ar": "تم إرسال",            "fr": "Envoyé:"},
    "print_to":         {"ar": "للطابعة:",            "fr": "à l'imprimante:"},
    "print_ok":         {"ar": "تم إرسال للطباعة.",  "fr": "Envoyé à l'impression."},
    "print_open_err":   {"ar": "خطأ في فتح الملف:",  "fr": "Erreur ouverture fichier:"},
    "print_fallback":   {"ar": "سيتم فتح الملف بدلاً من ذلك.",
                          "fr": "Le fichier sera ouvert à la place."},
    "print_err_title":  {"ar": "خطأ في الطباعة:",    "fr": "Erreur d'impression:"},
    "print_doc_lbl":    {"ar": "الوثيقة",             "fr": "Document"},
    # ── وثائق الامتحانات ─────────────────────────────────────────────────────
    "doc_exams_sec":    {"ar": "وثائق الامتحانات",    "fr": "Documents examen"},
    "doc_exam_cands":   {"ar": "قائمة المترشحين للامتحان","fr": "Liste des candidats examen"},
    "doc_tip":          {"ar": "💡 اختر مترشحاً ثم اضغط\nعلى نوع الوثيقة → PDF",
                          "fr": "💡 Choisissez un candidat\npuis le type de document → PDF"},
    "doc_contract_lbl": {"ar": "عقد التكوين",         "fr": "Contrat de formation"},
    "doc_cert_lbl":     {"ar": "شهادة إدارية",        "fr": "Attestation administrative"},
    "doc_receipt_lbl":  {"ar": "وصل دفع",             "fr": "Reçu de paiement"},
    "doc_search_cand":  {"ar": "ابحث عن مترشح:",      "fr": "Rechercher candidat:"},
    "doc_choose_cand":  {"ar": "اختر المترشح المطلوب","fr": "Choisir le candidat"},
    # ── عمود وثائق المترشحين ─────────────────────────────────────────────────
    "doc_col_num":      {"ar": "رقم",                 "fr": "N°"},
    "doc_col_last":     {"ar": "اللقب",               "fr": "Nom"},
    "doc_col_first":    {"ar": "الاسم",               "fr": "Prénom"},
    "doc_col_gender":   {"ar": "الجنس",               "fr": "Sexe"},
    "doc_col_lic":      {"ar": "نوع الرخصة",          "fr": "Type permis"},
    "doc_col_date":     {"ar": "تاريخ التسجيل",       "fr": "Date inscription"},
    # ── تقرير تحديد الفترة الزمنية ───────────────────────────────────────────
    "period_title":     {"ar": "تحديد الفترة الزمنية","fr": "Définir la période"},
    "period_filter":    {"ar": "تصفية التقرير بفترة زمنية",
                          "fr": "Filtrer le rapport par période"},
    "period_hint":      {"ar": "(اتركهما فارغين لعرض كل البيانات)",
                          "fr": "(Laisser vides pour tout afficher)"},
    "period_from":      {"ar": "من:",                 "fr": "De:"},
    "period_to":        {"ar": "إلى:",                "fr": "À:"},
    "period_apply":     {"ar": "تطبيق",               "fr": "Appliquer"},
    "period_all":       {"ar": "كل الفترات",          "fr": "Toutes les périodes"},
    "period_cancel":    {"ar": "إلغاء",               "fr": "Annuler"},
    "period_bad_from":  {"ar": "تنسيق تاريخ البداية غير صحيح\nالمطلوب: YYYY-MM-DD",
                          "fr": "Format date de début incorrect\nReqis: YYYY-MM-DD"},
    "period_bad_to":    {"ar": "تنسيق تاريخ النهاية غير صحيح\nالمطلوب: YYYY-MM-DD",
                          "fr": "Format date de fin incorrect\nRequis: YYYY-MM-DD"},
    # ── إدارة المستخدمين ─────────────────────────────────────────────────────
    "user_mgmt_sel_first":{"ar": "اختر مستخدماً أولاً","fr": "Sélectionnez un utilisateur"},
    "user_mgmt_add_fail": {"ar": "فشل الإضافة:",      "fr": "Échec de l'ajout:"},
    "user_mgmt_admin_info":{"ar": "حساب المدير يملك دائماً جميع الصلاحيات.",
                             "fr": "Le compte admin a toujours toutes les permissions."},
    # ── عقد المعلم (InstructorsFrame print) ──────────────────────────────────
    "inst_contract_ttl":{"ar": "عقد العمل",           "fr": "Contrat de travail"},
    # ── نص عقد العمل (مضمون القانون) — يبقى عربياً دائماً ─────────────────
    "inst_contract_ar": {"ar": True,                  "fr": False},
    # ── رسائل عامة ──────────────────────────────────────────────────────────
    "msg_confirm_del":   {"ar": "تأكيد الحذف",           "fr": "Confirmer la suppression"},
    "msg_confirm_del_q": {"ar": "هل أنت متأكد من حذف", "fr": "Êtes-vous sûr de supprimer"},
    "msg_sure_del":      {"ar": "هل أنت متأكد من حذف",   "fr": "Voulez-vous vraiment supprimer"},
    "msg_success":       {"ar": "نجاح ✓",                "fr": "Succès ✓"},
    "msg_error":         {"ar": "خطأ ✗",                 "fr": "Erreur ✗"},
    "msg_warning":       {"ar": "تنبيه",                 "fr": "Avertissement"},
    "msg_info":          {"ar": "معلومة",                "fr": "Information"},
    "msg_select_first":  {"ar": "اختر عنصراً أولاً",    "fr": "Sélectionnez un élément d'abord"},
    "msg_no_data":       {"ar": "لا توجد بيانات",        "fr": "Aucune donnée"},
    "msg_saved":         {"ar": "تم الحفظ بنجاح",        "fr": "Enregistré avec succès"},
    "msg_perm_denied":   {"ar": "ليس لديك صلاحية الوصول إلى هذا القسم.",
                          "fr": "Vous n'avez pas accès à cette section."},
    "msg_perm_title":    {"ar": "صلاحية مرفوضة",         "fr": "Accès refusé"},
    "msg_logout_q":      {"ar": "هل تريد تسجيل الخروج والعودة لشاشة الدخول؟",
                          "fr": "Voulez-vous vous déconnecter?"},
    "msg_logout_title":  {"ar": "تسجيل الخروج",          "fr": "Déconnexion"},
    "msg_cannot_del_self":{"ar": "لا يمكنك حذف حسابك الخاص.",    "fr": "Vous ne pouvez pas supprimer votre propre compte."},
    "msg_cannot_del_admin":{"ar": "لا يمكن حذف حساب midanic.",     "fr": "Impossible de supprimer le compte midanic."},
    "msg_fail_add":      {"ar": "فشل الإضافة:",           "fr": "Échec de l'ajout:"},
    # ── شريط الحالة ──────────────────────────────────────────────────────────
    "bar_candidates": {"ar": "المترشحون:",         "fr": "Candidats:"},
    "bar_instructors":{"ar": "الممرنون:",          "fr": "Moniteurs:"},
    "bar_arabic_ok":  {"ar": "العربية ✓",          "fr": "Arabe ✓"},
    "bar_arabic_err": {"ar": "العربية ✗",          "fr": "Arabe ✗"},
    "bar_db":         {"ar": "قاعدة البيانات ✓",  "fr": "Base de données ✓"},
    "bar_brand":      {"ar": "برنامج ميدانيك  |  الجزائر", "fr": "Meidanic  |  Algérie"},
    # ── عنوان الصفحة العلوي ──────────────────────────────────────────────────
    "topbar_home":    {"ar": "الرئيسية",      "fr": "Accueil"},
    # ── مرحلة التكوين ────────────────────────────────────────────────────────
    "stage_code":    {"ar": "الكود (نظري)",        "fr": "Code (théorique)"},
    "stage_creneau": {"ar": "الكرينو (مناورات)",   "fr": "Créneau (manœuvres)"},
    "stage_circuit": {"ar": "الطريق (سياقة)",      "fr": "Circuit (conduite)"},
    "train_title":   {"ar": "📚  مراحل التكوين",   "fr": "📚  Étapes de formation"},
    "train_subtitle":{"ar": "تتبع مراحل تكوين المترشحين", "fr": "Suivi des étapes de formation"},
    "train_select":  {"ar": "اختر مترشحاً من القائمة",   "fr": "Sélectionnez un candidat"},
    "train_no_cand": {"ar": "لا يوجد مترشحون مسجلون",    "fr": "Aucun candidat inscrit"},
    # ── فلتر التاريخ ─────────────────────────────────────────────────────────
    "dlg_period_title":  {"ar": "تحديد الفترة الزمنية",        "fr": "Sélectionner la période"},
    "dlg_period_lbl":    {"ar": "تصفية التقرير بفترة زمنية",   "fr": "Filtrer le rapport par période"},
    "dlg_period_hint":   {"ar": "(اتركهما فارغين لعرض كل البيانات)", "fr": "(Laisser vide pour toutes les données)"},
    "dlg_from":          {"ar": "من:",  "fr": "De:"},
    "dlg_to":            {"ar": "إلى:","fr": "À:"},
    "dlg_date_fmt":      {"ar": "(YYYY-MM-DD)", "fr": "(AAAA-MM-JJ)"},
    # ── شريط جانبي ──────────────────────────────────────────────────────────
    "sidebar_subtitle":  {"ar": "إدارة مدرسة السياقة", "fr": "Gestion auto-école"},
    "sidebar_role_admin":{"ar": "مدير النظام",          "fr": "Administrateur"},
    "sidebar_role_train":{"ar": "ممرّن",                "fr": "Moniteur"},
    "sidebar_user_def":  {"ar": "مستخدم",               "fr": "Utilisateur"},
    # ── قيم افتراضية لحقول نموذج المترشح ────────────────────────────────────
    "cdlg_default_nationality":   {"ar": "جزائرية",  "fr": "Algérienne"},
    "cdlg_default_birth_country": {"ar": "الجزائر",  "fr": "Algérie"},
    # ── ملاحظة الدفعة الأولى عند التسجيل ────────────────────────────────────
    "pay_initial_note":  {"ar": "الدفعة الأولى عند التسجيل", "fr": "Acompte à l'inscription"},
}


def T(key: str) -> str:
    """يُعيد النص باللغة الحالية. يرجع للعربية إن لم توجد ترجمة."""
    entry = STRINGS.get(key)
    if entry is None:
        return key
    return entry.get(LANG, entry.get("ar", key))


def A() -> str:
    """محدد الارتكاز بحسب اتجاه اللغة: e (يمين) للعربية، w (يسار) للفرنسية."""
    return "e" if LANG == "ar" else "w"


def J() -> str:
    """محاذاة النص بحسب اتجاه اللغة: right للعربية، left للفرنسية."""
    return "right" if LANG == "ar" else "left"


def S() -> str:
    """جانب تعبئة العناصر الرئيسية: right للعربية (RTL)، left للفرنسية (LTR)."""
    return "right" if LANG == "ar" else "left"


def So() -> str:
    """جانب تعبئة العناصر الثانوية (عكس S): left للعربية، right للفرنسية."""
    return "left" if LANG == "ar" else "right"


# ============================================================================
#  الإعدادات والثوابت
# ============================================================================

if getattr(sys, 'frozen', False):
    _BASE_DIR = os.path.dirname(sys.executable)
else:
    _BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _get_data_dir() -> str:
    """Return a writable, stable directory for user data and the SQLite DB."""
    if sys.platform == "win32":
        data_root = (
            os.environ.get("LOCALAPPDATA")
            or os.environ.get("APPDATA")
            or os.path.expanduser("~")
        )
    else:
        data_root = os.environ.get(
            "XDG_DATA_HOME",
            os.path.join(os.path.expanduser("~"), ".local", "share"),
        )

    data_dir = os.path.join(data_root, "Medanic")
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


def _prepare_database_path() -> str:
    """
    Keep the database outside the executable directory.

    Existing installations are migrated by copying the database (and any
    SQLite WAL/SHM sidecar files) to the new location. The original file is
    deliberately kept as a backup and is never deleted.
    """
    data_dir = _get_data_dir()
    database_name = "driving_school.db"
    new_path = os.path.join(data_dir, database_name)
    legacy_path = os.path.join(_BASE_DIR, database_name)

    if os.path.exists(new_path) or not os.path.exists(legacy_path):
        return new_path

    temp_path = f"{new_path}.migrating"
    try:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        shutil.copy2(legacy_path, temp_path)
        os.replace(temp_path, new_path)

        # Preserve pending SQLite transactions if the old installation used
        # WAL mode and was closed before this first launch.
        for suffix in ("-wal", "-shm"):
            old_sidecar = f"{legacy_path}{suffix}"
            new_sidecar = f"{new_path}{suffix}"
            if os.path.exists(old_sidecar) and not os.path.exists(new_sidecar):
                shutil.copy2(old_sidecar, new_sidecar)
    except OSError:
        # If migration is blocked by a filesystem permission issue, keep the
        # application usable with the legacy location instead of losing data.
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        return legacy_path

    return new_path


DB_PATH = _prepare_database_path()

# ----- الخطوط -----
FONT_FAMILY = "Tahoma"
FONT_MAIN   = (FONT_FAMILY, 11)
FONT_BOLD   = (FONT_FAMILY, 11, "bold")
FONT_TITLE  = (FONT_FAMILY, 15, "bold")
FONT_HEADER = (FONT_FAMILY, 18, "bold")
FONT_SMALL  = (FONT_FAMILY, 10)
FONT_TINY   = (FONT_FAMILY, 9)

# ----- الألوان (تصميم عصري وجذاب) -----
COLOR_PRIMARY      = "#4F46E5"   # أزرق بنفسجي جذاب (Indigo)
COLOR_PRIMARY_DARK = "#3730A3"
COLOR_PRIMARY_LIGHT= "#E0E7FF"
COLOR_ACCENT       = "#F59E0B"   # برتقالي دافئ
COLOR_SUCCESS      = "#10B981"   # أخضر نيون منعش
COLOR_DANGER       = "#EF4444"   # أحمر حيوي
COLOR_WARNING      = "#F59E0B"
COLOR_INFO         = "#0EA5E9"   # أزرق سماوي
COLOR_PURPLE       = "#8B5CF6"   # بنفسجي

COLOR_BG           = "#F8FAFC"   # خلفية بيضاء مزرقة مريحة
COLOR_CARD         = "#FFFFFF"
COLOR_SIDEBAR      = "#1E293B"   # سايد بار رمادي مزرق أنيق
COLOR_SIDEBAR_HOVER= "#334155"
COLOR_HEADER       = "#0F172A"
COLOR_TEXT         = "#0F172A"
COLOR_TEXT_LIGHT   = "#64748B"
COLOR_BORDER       = "#CBD5E1"
COLOR_INPUT_BG     = "#F1F5F9"
COLOR_WHITE        = "#FFFFFF"

MONTHS_AR = {"01":"يناير","02":"فبراير","03":"مارس","04":"أبريل","05":"مايو","06":"يونيو",
             "07":"يوليو","08":"أغسطس","09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر"}
MONTHS_FR = {"01":"Janvier","02":"Février","03":"Mars","04":"Avril","05":"Mai","06":"Juin",
             "07":"Juillet","08":"Août","09":"Septembre","10":"Octobre","11":"Novembre","12":"Décembre"}

STAGE_LABELS = {"code":"الكود (نظري)", "creneau":"الكرينو (مناورات)", "circuit":"الطريق (سياقة)"}
STAGE_ORDER  = ["code", "creneau", "circuit"]
STATUS_PASS  = "ناجح"

# ── شروط الحد الأدنى للسن حسب الصنف ─────────────────────────────────────────
LICENSE_MIN_AGE = {"A1": 16, "A": 17, "F": 17, "B": 17, "C1": 23, "C": 25, "D": 25, "E": 25}
LICENSE_CIRCUIT_AGE = {"A": 18, "F": 18, "B": 18}  # سن إضافية لفتح مرحلة السيركوي
LICENSE_CODE_ONLY = {"A1"}  # أصناف تقتصر على مرحلة الكود فقط

def _calc_age(birth_date_str):
    """تعيد العمر بالسنوات المكتملة، أو None إذا كان التاريخ فارغاً/خاطئاً."""
    if not birth_date_str or not str(birth_date_str).strip():
        return None
    try:
        bd = datetime.strptime(str(birth_date_str).strip(), "%Y-%m-%d").date()
        today = date.today()
        return today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    except Exception:
        return None

STATUS_OPTIONS         = ["لم يبدأ", "قيد التكوين", "ناجح", "راسب"]
GENDER_OPTIONS         = ["ذكر", "أنثى"]
MARITAL_OPTIONS        = ["أعزب", "متزوج", "مطلق", "أرمل"]
LICENSE_OPTIONS        = ["A1", "A", "B", "C1", "C", "D", "E", "F"]
PAYMENT_METHOD_OPTIONS = ["نقدي", "تحويل بنكي", "شيك"]
BLOOD_TYPE_OPTIONS     = ["A+","A-","B+","B-","AB+","AB-","O+","O-"]
EXPENSE_TYPES          = ["وقود","صيانة","كراء","رواتب","تأمين","إعلان","مستلزمات مكتبية","أخرى"]
EXAM_TYPE_OPTIONS      = ["نظري", "تطبيقي"]
EXAM_RESULT_OPTIONS    = ["ناجح", "راسب"]

# ── Bilingual option mappings (DB always stores Arabic values) ──────────────
_GENDER_FR    = ["Masculin", "Féminin"]
_GENDER_AR_L  = ["ذكر", "أنثى"]
_GENDER_FR2AR = dict(zip(_GENDER_FR, _GENDER_AR_L))
_GENDER_AR2FR = dict(zip(_GENDER_AR_L, _GENDER_FR))

_MARITAL_FR    = ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf/Veuve"]
_MARITAL_AR_L  = ["أعزب", "متزوج", "مطلق", "أرمل"]
_MARITAL_FR2AR = dict(zip(_MARITAL_FR, _MARITAL_AR_L))
_MARITAL_AR2FR = dict(zip(_MARITAL_AR_L, _MARITAL_FR))

_PAYMTH_FR    = ["Espèces", "Virement bancaire", "Chèque"]
_PAYMTH_AR    = ["نقدي", "تحويل بنكي", "شيك"]
_PAYMTH_FR2AR = dict(zip(_PAYMTH_FR, _PAYMTH_AR))
_PAYMTH_AR2FR = dict(zip(_PAYMTH_AR, _PAYMTH_FR))

_ETYPE_FR    = ["Théorique", "Pratique"]
_ETYPE_AR    = ["نظري", "تطبيقي"]
_ETYPE_FR2AR = dict(zip(_ETYPE_FR, _ETYPE_AR))
_ETYPE_AR2FR = dict(zip(_ETYPE_AR, _ETYPE_FR))

_ERES_FR    = ["Reçu", "Échoué"]
_ERES_AR    = ["ناجح", "راسب"]
_ERES_FR2AR = dict(zip(_ERES_FR, _ERES_AR))
_ERES_AR2FR = dict(zip(_ERES_AR, _ERES_FR))

def gender_opts():         return _GENDER_FR    if LANG == "fr" else _GENDER_AR_L
def marital_opts():        return _MARITAL_FR   if LANG == "fr" else _MARITAL_AR_L
def payment_method_opts(): return _PAYMTH_FR    if LANG == "fr" else _PAYMTH_AR
def exam_type_opts():      return _ETYPE_FR     if LANG == "fr" else _ETYPE_AR
def exam_result_opts():    return _ERES_FR      if LANG == "fr" else _ERES_AR

def to_ar_gender(v):      return _GENDER_FR2AR.get(v, v)
def to_ar_marital(v):     return _MARITAL_FR2AR.get(v, v)
def to_ar_pay_mth(v):     return _PAYMTH_FR2AR.get(v, v)
def to_ar_exam_type(v):   return _ETYPE_FR2AR.get(v, v)
def to_ar_exam_result(v): return _ERES_FR2AR.get(v, v)

def to_disp_gender(v):      return _GENDER_AR2FR.get(v, v)   if LANG == "fr" else v
def to_disp_marital(v):     return _MARITAL_AR2FR.get(v, v)  if LANG == "fr" else v
def to_disp_pay_mth(v):     return _PAYMTH_AR2FR.get(v, v)   if LANG == "fr" else v
def to_disp_exam_type(v):   return _ETYPE_AR2FR.get(v, v)    if LANG == "fr" else v
def to_disp_exam_result(v): return _ERES_AR2FR.get(v, v)     if LANG == "fr" else v
ALGERIA_WILAYAS = [
    "01 - أدرار", "02 - الشلف", "03 - الأغواط", "04 - أم البواقي",
    "05 - باتنة", "06 - بجاية", "07 - بسكرة", "08 - بشار",
    "09 - البليدة", "10 - البويرة", "11 - تمنراست", "12 - تبسة",
    "13 - تلمسان", "14 - تيارت", "15 - تيزي وزو", "16 - الجزائر",
    "17 - الجلفة", "18 - جيجل", "19 - سطيف", "20 - سعيدة",
    "21 - سكيكدة", "22 - سيدي بلعباس", "23 - عنابة", "24 - قالمة",
    "25 - قسنطينة", "26 - المدية", "27 - مستغانم", "28 - المسيلة",
    "29 - معسكر", "30 - ورقلة", "31 - وهران", "32 - البيض",
    "33 - إليزي", "34 - برج بوعريريج", "35 - بومرداس", "36 - الطارف",
    "37 - تندوف", "38 - تيسمسيلت", "39 - الوادي", "40 - خنشلة",
    "41 - سوق أهراس", "42 - تيبازة", "43 - ميلة", "44 - عين الدفلى",
    "45 - النعامة", "46 - عين تموشنت", "47 - غرداية", "48 - غليزان",
    "49 - تيميمون", "50 - برج باجي مختار", "51 - أولاد جلال",
    "52 - بني عباس", "53 - عين صالح", "54 - عين قزام",
    "55 - توقرت", "56 - جانت", "57 - المغير", "58 - المنيعة",
]

ALGERIA_COMMUNES: dict[str, list[str]] = {
    "01 - أدرار": ["أدرار", "رقان", "تيمياوين", "بودة", "أولف", "تيت", "شروين", "أقبلي", "أنزقمير", "تامست", "تيميمون", "شارويين", "دلدول", "سبع", "زاوية كنتة", "فنوغيل", "تيمقتن", "عين صالح", "إينجر", "بوعلام", "عرق", "أولاد أحمد تيمي"],
    "02 - الشلف": ["الشلف", "تنس", "بني حوا", "المرسى", "الهرانفة", "وادي الفضة", "سيدي عكاشة", "أبو الحسن", "الظهرة", "بريرة", "حرشون", "عين مران", "الكريمية", "أولاد فارس", "سيدي عبد الرحمن", "بوقدير", "بني بوعتاب", "وادي سلي", "سنجاس", "الزبوجة", "الخطارنة", "الأبيض مجاجة", "بني رحال", "لاطرش", "هرمل", "حيدوسة", "العطاف", "مصطفى بن إبراهيم", "بلعاص"],
    "03 - الأغواط": ["الأغواط", "آفلو", "قصر الشلالة", "عين الإبل", "حاسي الرمل", "سيدي بوزيد", "تاجموت", "برج بن عزوز", "الحاج المشري", "وادي مزي", "بريدة", "عريبة", "الحويطة", "بن ناصر بن شهرة", "تاويالة", "سبقاق", "خنق سيدي ناجي", "قلتة سيدي سعد", "عين ماضي", "الغيشة"],
    "04 - أم البواقي": ["أم البواقي", "عين فكرون", "عين مليلة", "سيقوس", "عين البيضاء", "الفجوج", "بلالة", "بريش", "عين الديس", "الرحية", "الضلعة", "ثليجان", "بئر الشهداء", "عين قشرة", "الهرقلة", "سرية", "عين بابوش", "العامرية", "زورق", "فكيرينة", "مسكيانة", "عين خضراء"],
    "05 - باتنة": ["باتنة", "أريس", "تيمقاد", "بريكة", "عين توتة", "لمباركية", "سفيان", "منعة", "أولاد سي سليمان", "راس العيون", "شعبة", "المعذر", "فسديس", "ثنية العابد", "عزيل عبد القادر", "بومقر", "الشير", "نقاوس", "أولاد عمار", "أولاد حماد", "تزولت", "عيون العصافير", "كيمل", "إينوغيسن", "قيقبة", "غاسطي", "أولاد سلام", "لازرو", "حيدوس", "أولاد فاضل", "إشمول", "واد الماء", "بودزيان", "تكوت", "جرمة", "زانة البيضاء", "سقانة", "عيون الكرمة", "وادي الشعبة"],
    "06 - بجاية": ["بجاية", "عكبو", "تيغي", "أميزور", "الفلاي", "خراطة", "كيرانة", "تيشي", "بني كسيلة", "سوق الاثنين", "صدوق", "أقبيل", "إيغيل علي", "بني معوش", "الأخضرية", "أوزلاقن", "سماون", "المسيلة", "بني جليل", "إيفري", "أغرييف", "بربشة", "بوخليفة", "بني مليكيش", "شميني", "الفناية إيلمتن", "المالة", "أيث سمايل", "أيث رزين", "درعة الكيداد", "بوزلاقن", "أقلو", "أيث إعباش"],
    "07 - بسكرة": ["بسكرة", "طولقة", "سيدي عقبة", "أورلال", "فوغالة", "الشعيبة", "القنطرة", "زريبة الوادي", "برانيس", "بوشقرون", "ذراع الرمل", "مشونش", "ليشانة", "بوحمامة", "المزيرعة", "ليوة", "سيدي خالد", "الحاجب", "الجزار", "أوماش", "المجنيش", "برج بن عزوز", "شتمة", "وادي جلال", "بسباس", "بئر مقدم", "خنقة سيدي ناجي"],
    "08 - بشار": ["بشار", "البيض", "تاغيت", "كولاة", "بني عباس", "القصابي", "مرحوم", "ثالث", "عبادلة", "تامتر", "أيوات", "بني ونيف", "إقلي", "قصابي", "بوكايس", "تبلبالة", "مشرع هواري بومدين"],
    "09 - البليدة": ["البليدة", "الأربعاء", "بوعرفة", "بن خليل", "بوفاريك", "بوينان", "شبلي", "بني مراد", "خميس الخشنة", "مفتاح", "موزاية", "أولاد يعيش", "الصواف", "شريعة", "بوعيش", "لرها"],
    "10 - البويرة": ["البويرة", "لقصر", "عين بسام", "ورجة", "برج أوخريص", "أقبيل", "حمام المهاريين", "ماالك", "أولاد رشاش", "عين لحجر", "راشدية", "الهاشمية", "أولاد سلامة", "ديرة", "السواقي"],
    "11 - تمنراست": ["تمنراست", "عين صالح", "عين قزام", "إيليزي", "جانت", "إن أميناس", "إن أقر", "عين أميناس"],
    "12 - تبسة": ["تبسة", "الشريعة", "بئر العاتر", "قصيبة", "الحمامات", "العقلة", "ثليجان", "النقرين", "عين الزيتونة", "الونزة", "الجرف", "مرسط", "بوخضرة", "فركان", "الكويف", "أولاد رحمة"],
    "13 - تلمسان": ["تلمسان", "وهران", "سيدي بلعباس", "مغنية", "رمشي", "صبرة", "بني مستار", "بنى سنوس", "أولاد ميمون", "عين تالوت", "عين ناضج", "حمام بوغرارة", "أولاد رياح", "سبدو", "جبالة", "الفحول", "بني بوسعيد", "بني خلاد", "عين فزة", "سيدي الجيلاني", "زناتة", "القور", "سيدي مجاهد", "تيرني باني", "عين غرابة", "بني سميل", "بني يقوبن", "إيساجن", "السواني", "غزويل", "مرسى بن مهيدي", "بيضاء", "علاف"],
    "14 - تيارت": ["تيارت", "مهلة", "عين الذهب", "الرحوية", "فرندة", "سوق ثلاثاء", "وادي ليلي", "قصر الشلالة", "قطارة", "دهمانية", "مدروسة", "المهيانة", "رحل", "سيدي بختي", "السرسو", "بوكيرات", "عيون الجواب"],
    "15 - تيزي وزو": ["تيزي وزو", "درعة بن خدة", "أزفون", "أقبيل", "عين البركاء", "البويرة", "إيفربن", "ماتقا", "واضية", "تيبحيرين", "أولاد عيسى", "تيرمتين", "بني عيسى", "إيليلتن", "أيث ورثيلان", "أيث زيقي", "أيث يحي موسى", "بوزقن", "يطافن", "مقلع", "تيقزيرت", "أيث محمود", "تمزريت", "إيفيغا", "إيلوان", "أيث خليلي", "تادماييت", "واتشن", "بني عيثه", "سيدي ناعمان", "آقريب", "عزازقة", "أيث عيشة", "واريتشن", "سعيدة", "أيث كحال"],
    "16 - الجزائر": ["الجزائر المركز", "باب الوادي", "الحراش", "حيدرة", "بولوغين", "القبة", "الكاليتوس", "الدار البيضاء", "برج البحري", "الأرغو", "بئر مراد رايس", "خرايسية", "سيدي محمد", "براقي", "بني مسوس", "حمامات الملكية", "الرويبة", "رغاية", "باب الزوار", "الشراقة", "الدرارية", "سيدي عبد الله", "المرادية", "زرالدة", "سطاوالي", "تسالة المرمورة", "سيدي امحمد", "القبة القديمة", "المحمدية"],
    "17 - الجلفة": ["الجلفة", "أيت بلوط", "عين وسارة", "حاسي بحبح", "دار الشيوخ", "شعبة اللحم", "بيرين", "سلمانة", "عموريت", "موسعد", "فيض البطمة", "حد الصحاري", "قتارة", "بني يعقوب", "مسعد", "زكار", "زيارة", "عين إبل", "سيدي بايزيد"],
    "18 - جيجل": ["جيجل", "الميلية", "الطاهير", "سيدي معروف", "عزابة", "بني يعلى", "زيامة منصورية", "شقفة", "السطارة", "أولاد يحيى خدروش", "عوانة", "غبالة", "الشقفة", "سلمى بن زيادة", "بودريعة", "إيرجن", "الجيل"],
    "19 - سطيف": ["سطيف", "قجال", "عين لحجر", "بئر العرش", "بوعنداس", "صالح باي", "تيزي نبشار", "حمام قرقور", "أولاد عدوان", "راس الواد", "المعاضيد", "عين أرنات", "خوبانة", "عين الروى", "بابور", "برج زمورة", "قصر الأبطال", "بازر سقن", "عين السبت", "أولاد سي أحمد", "بروجة", "عين تيرك", "سطارة", "عين وسارة"],
    "20 - سعيدة": ["سعيدة", "عين الحجر", "يوب", "سيدي أحمد", "حوارة", "مولاي لارباع", "عامورة", "دوي ثابت", "أولاد خالد"],
    "21 - سكيكدة": ["سكيكدة", "القل", "الحروش", "رمضان جمال", "عزابة", "زردازة", "بئر الشعيبية", "فلفلة", "عين بازيلة", "كركرة", "واد الزهور", "أولاد حبابة", "صالح باي"],
    "22 - سيدي بلعباس": ["سيدي بلعباس", "تلاغ", "محمد بن علي", "تاودموت", "أهل الصف", "مكحل", "عين ثريد", "عين العذب", "سيدي شعيب", "أيت الجمال", "بلعريبي", "سفيزف", "تسالة", "مرين"],
    "23 - عنابة": ["عنابة", "سرحان", "الشط", "البرج", "سيدي عمار", "الحجار", "العثمانية", "ولاية", "بير الحمام"],
    "24 - قالمة": ["قالمة", "بوشقوف", "تامليلت", "الدهوارة", "فيجان", "بلخير", "نشماية", "عين مخلوف", "اللبن", "بن جراح", "الرأس الأحمر", "سلواز"],
    "25 - قسنطينة": ["قسنطينة", "الخروب", "الحامة بوزيان", "ديدوش مراد", "عين عبيد", "أولاد رحمة", "عين سمارة", "الزيغود يوسف", "ابن باديس", "بني حميدان"],
    "26 - المدية": ["المدية", "بئر بن عبد المالك", "البرواقية", "قصر البخاري", "التلة", "شلالة العذاورة", "دراق", "بوعيش", "عين بوسيف", "حناشة", "عزيزة", "أم الجليل", "عين الله", "سغروشن", "اليومي", "جواب"],
    "27 - مستغانم": ["مستغانم", "عشعاشة", "سور", "حجاج", "خضرا", "عين تادلس", "تازقايت", "سانق"],
    "28 - المسيلة": ["المسيلة", "بوسعادة", "سيدي عيسى", "مجبر", "أولاد مادي", "عين الحجل", "القلتة", "سيدي اعمر", "الوانوغة", "بنهار", "عين الريش", "الحمامة"],
    "29 - معسكر": ["معسكر", "تيارت", "المحمدية", "فروحة", "مقطع الدوز", "عين الفارس", "أولاد مماد", "سيق", "غريس", "العيون"],
    "30 - ورقلة": ["ورقلة", "حاسي مسعود", "النقوسة", "أم رنان", "تاقصبت", "الحجيرة", "سيدي سليمان", "روينة", "بن ناصر", "زاوية العابدية"],
    "31 - وهران": ["وهران", "عين الترك", "بطيوة", "برحيم", "المرسى الكبير", "سيدي الشحمي", "أرزيو", "مسرغين", "طفراوي", "سيدي عبد الله"],
    "32 - البيض": ["البيض", "الأبيض سيدي الشيخ", "الشلالة", "العسلا", "سيدي عمر", "عين الشهداء", "تيوت", "بوقطب"],
    "33 - إليزي": ["إيليزي", "إن أميناس", "دبداب", "برج عمر إدريس", "جانت", "إن أزاوا"],
    "34 - برج بوعريريج": ["برج بوعريريج", "الرأس الأبيض", "المنصورة", "بلدية المقرن", "أولاد داود", "تيمديكان", "العش", "الطرفاية", "راس الوادي"],
    "35 - بومرداس": ["بومرداس", "بوردج بوعريريج", "روينة", "خميس الخشنة", "الثنية", "بودواو", "أفير", "عين تيرك", "قابو"],
    "36 - الطارف": ["الطارف", "القالة", "بوحجار", "الشط", "عين العسل", "وادي الزيتون", "درعة", "العيون"],
    "37 - تندوف": ["تندوف", "أم العسل"],
    "38 - تيسمسيلت": ["تيسمسيلت", "بوقارة", "ثنية الحد", "خميستي", "لاربعة", "الأزهرية", "سيدي عبد الرحمن", "الملحة", "سيدي بوتشنت", "مزيرعة"],
    "39 - الوادي": ["الوادي", "بهيم", "بلدة أمور", "ورماس", "المقرن", "سيدي عون", "الرباح", "حساني عبد الكريم", "الطالب العربي", "جامعة", "الدبيلة", "المريج", "حاسي خليفة", "ورقلة"],
    "40 - خنشلة": ["خنشلة", "بكاريا", "بابار", "تاوزيانت", "قايس", "شلية", "أولاد رشاش", "ماستر"],
    "41 - سوق أهراس": ["سوق أهراس", "سدراتة", "عين الزانة", "تاورة", "مجاز الصفا", "المشروحة", "حنانشة", "وادي الكبريت", "أولاد ملول"],
    "42 - تيبازة": ["تيبازة", "شرشال", "الشفة", "هاجر الرأس", "بواسماعيل", "سيدي راشد", "حجوط", "بوهارون", "القليعة", "أفون", "مناصر"],
    "43 - ميلة": ["ميلة", "فرجيوة", "الشيگة", "شلغوم العيد", "أحمد راشدي", "وادي الرطب", "المشيرة"],
    "44 - عين الدفلى": ["عين الدفلى", "المليانة", "العطاف", "جمعة لخضر", "خميس مليانة", "رواقي", "مشرع الصفا", "عبادية"],
    "45 - النعامة": ["النعامة", "المشرية", "عين الصفراء", "جنين بورزق", "تيوت", "شلالة"],
    "46 - عين تموشنت": ["عين تموشنت", "بني صاف", "سيدي بن عدة", "حمام بوحجر", "حساين", "أولاد بو جمعة", "حمام بوغرارة"],
    "47 - غرداية": ["غرداية", "القرارة", "العطف", "بريان", "منيعة", "بني يزقن", "متليلي", "أولاد رشيد", "ضاية بن ضحوة", "سبسب", "زلفانة"],
    "48 - غليزان": ["غليزان", "عين تاريق", "مسرة", "الزمورة", "بوماهر", "واريزان", "أولاد يعيش", "سيدي خطاب"],
    "49 - تيميمون": ["تيميمون", "أوقروت", "شارويين", "تلمين", "إينجر", "أقبلي"],
    "50 - برج باجي مختار": ["برج باجي مختار", "تيمياوين"],
    "51 - أولاد جلال": ["أولاد جلال", "الدوسن", "سيدي خالد"],
    "52 - بني عباس": ["بني عباس", "بشار", "تابلبالة", "كولاة"],
    "53 - عين صالح": ["عين صالح", "إن جاورن", "فقارة الزوى"],
    "54 - عين قزام": ["عين قزام", "تين زاوتن", "بوربوش"],
    "55 - توقرت": ["توقرت", "بن ناصر", "جامعة", "تبسبست", "المغير"],
    "56 - جانت": ["جانت", "إيليزي"],
    "57 - المغير": ["المغير", "جامعة", "الرباح"],
    "58 - المنيعة": ["المنيعة", "حاسي القارة", "حاسي فحل"],
}

# ── المستخدم الحالي (يُسنَّد عند الدخول) ───────────────────────────────────
CURRENT_USER: dict = {}

# ── الصلاحيات ──────────────────────────────────────────────────────────────
PERMISSION_LABELS = {
    "view_dashboard":     "عرض الرئيسية (لوحة القيادة)",
    "view_candidates":    "عرض المترشحين",
    "edit_candidates":    "إضافة / تعديل / حذف المترشحين",
    "view_payments":      "عرض المدفوعات",
    "add_payments":       "إضافة المدفوعات",
    "view_expenses":      "عرض المصاريف",
    "view_training":      "عرض مراحل التكوين",
    "view_schedule":      "عرض الجدول الزمني",
    "print_docs":         "طباعة الوثائق",
    "view_reports":       "عرض التقارير",
    "manage_school_info": "إدارة معلومات المدرسة",
}
PERMISSION_KEYS = list(PERMISSION_LABELS.keys())

# صلاحية مطلوبة لكل صفحة (None = لا قيد — دائماً مرئية)
NAV_PERMISSIONS = {
    0: "view_dashboard",       # الرئيسية
    1: "manage_school_info",   # معلومات المدرسة
    2: "view_candidates",      # المترشحون
    3: None,                   # الممرنون (admin فقط — يُعالَج منفصلاً)
    4: "view_training",        # مراحل التكوين
    5: "view_schedule",        # الجدول الزمني
    6: "view_payments",        # المدفوعات
    7: "view_expenses",        # المصاريف
    8: "view_reports",         # التقارير
    9: "print_docs",           # طباعة الوثائق
    10: "view_graduates",      # المتخرجون
}


# ============================================================================
#  دعم العربية في PDF
# ============================================================================

def find_arabic_font():
    """يبحث عن خط TTF يدعم العربية على النظام."""
    candidates = [
        # Windows
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\tahoma.ttf",
        r"C:\Windows\Fonts\trado.ttf",
        # macOS
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/GeezaPro.ttc",
        # Linux
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/nix/store/*/share/fonts/truetype/DejaVuSans.ttf",
    ]
    for p in candidates:
        if "*" in p:
            import glob
            matches = glob.glob(p)
            if matches:
                return matches[0]
        elif os.path.exists(p):
            return p
    # محاولة أخيرة: البحث في مجلدات الخطوط
    for base in ["/usr/share/fonts", "/nix/store"]:
        if os.path.isdir(base):
            for root, _, files in os.walk(base):
                for f in files:
                    if f.lower() in ("dejavusans.ttf", "freesans.ttf", "arial.ttf"):
                        return os.path.join(root, f)
    return None


ARABIC_FONT = "Helvetica"
ARABIC_FONT_BOLD = "Helvetica-Bold"
if HAS_REPORTLAB:
    fp = find_arabic_font()
    if fp:
        try:
            pdfmetrics.registerFont(TTFont("ArabicFont", fp))
            ARABIC_FONT = "ArabicFont"
            # محاولة العثور على نسخة Bold
            bold_path = fp.replace(".ttf", "-Bold.ttf")
            if os.path.exists(bold_path):
                pdfmetrics.registerFont(TTFont("ArabicFontBold", bold_path))
                ARABIC_FONT_BOLD = "ArabicFontBold"
            else:
                ARABIC_FONT_BOLD = "ArabicFont"
        except Exception:
            pass


def ar(text):
    """يحوّل النص العربي للعرض الصحيح في PDF (تشكيل + bidi)."""
    if text is None or text == "":
        return ""
    s = str(text)
    if HAS_ARABIC_LIBS:
        try:
            return get_display(arabic_reshaper.reshape(s))
        except Exception:
            return s
    return s


def _ptxt(text):
    """Process text for PDF: apply bidi for Arabic, plain for French."""
    if text is None or text == "":
        return ""
    return ar(str(text)) if LANG != "fr" else str(text)


def _pdf_t(ar_text, fr_text):
    """Return Arabic or French text based on current language."""
    return fr_text if LANG == "fr" else ar_text

def _no_wnum(w):
    """إزالة الرقم الولائي عند الطباعة: '29 - معسكر' → 'معسكر'"""
    if w and ' - ' in w:
        return w.split(' - ', 1)[1].strip()
    return w or ""


_A4_W_CM = 21.0  # A4 width in cm (used for LTR/RTL mirroring in canvas-based docs)

_FR_VALUE_MAP = {
    "ذكر": "Masculin",
    "أنثى": "Féminin",
    "أعزب": "Célibataire",
    "عزباء": "Célibataire",
    "متزوج": "Marié",
    "متزوجة": "Mariée",
    "مطلق": "Divorcé",
    "مطلقة": "Divorcée",
    "أرمل": "Veuf",
    "أرملة": "Veuve",
    "نقدي": "Espèces",
    "بنكي": "Virement bancaire",
    "شيك": "Chèque",
    "ناجح": "Admis",
    "راسب": "Refusé",
    "لم يبدأ": "Non commencé",
    "قيد التكوين": "En cours",
    "جزائري": "Algérien",
    "جزائرية": "Algérienne",
}

def _fr_val(text):
    """Translate Arabic enum/DB value to French if LANG=='fr', else return as-is."""
    if LANG != "fr" or not text:
        return str(text) if text else ""
    return _FR_VALUE_MAP.get(str(text).strip(), str(text))


# ============================================================================
#  قاعدة البيانات SQLite
# ============================================================================

def _set_app_icon(root):
    """يُطبّق أيقونة البرنامج على نافذة Tk (يدعم EXE وملفات .py)."""
    try:
        import sys, os
        base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
        ico = os.path.join(base, "medanic_icon.ico")
        if os.path.exists(ico):
            root.iconbitmap(ico)
            return
        png = os.path.join(base, "medanic_logo.png")
        if os.path.exists(png):
            from tkinter import PhotoImage
            img = PhotoImage(file=png)
            root.iconphoto(True, img)
            root._icon_ref = img  # نحتفظ بمرجع
    except Exception:
        pass


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def upgrade_db():
    """يضيف الأعمدة الجديدة لقاعدة بيانات قديمة (توافق رجعي)."""
    conn = get_connection()
    try:
        # أعمدة جدول المترشحين
        cur = conn.execute("PRAGMA table_info(candidates)")
        cand_existing = {row[1] for row in cur.fetchall()}
        cand_cols = [
            ("national_id",        "TEXT DEFAULT ''"),
            ("second_nationality", "TEXT DEFAULT ''"),
            ("current_address",    "TEXT DEFAULT ''"),
            ("is_born_abroad",     "INTEGER DEFAULT 0"),
            ("birth_country",      "TEXT DEFAULT 'الجزائر'"),
            ("embassy",            "TEXT DEFAULT ''"),
            ("consulate",          "TEXT DEFAULT ''"),
            ("file_number",        "TEXT DEFAULT ''"),
            ("file_date",          "TEXT DEFAULT ''"),
            ("address_commune",    "TEXT DEFAULT ''"),
            ("address_wilaya",     "TEXT DEFAULT ''"),
            ("last_name_fr",       "TEXT DEFAULT ''"),
            ("first_name_fr",      "TEXT DEFAULT ''"),
            ("insurance_number",   "TEXT DEFAULT ''"),
            ("email",              "TEXT DEFAULT ''"),
            ("guardian_first_name","TEXT DEFAULT ''"),
            ("guardian_last_name", "TEXT DEFAULT ''"),
            ("guardian_birth_date","TEXT DEFAULT ''"),
            ("guardian_address",   "TEXT DEFAULT ''"),
            ("guardian_phone",     "TEXT DEFAULT ''"),
        ]
        for col, dtype in cand_cols:
            if col not in cand_existing:
                conn.execute(f"ALTER TABLE candidates ADD COLUMN {col} {dtype}")

        # أعمدة جدول الممرنين
        cur2 = conn.execute("PRAGMA table_info(instructors)")
        inst_existing = {row[1] for row in cur2.fetchall()}
        inst_cols = [
            ("birth_place",           "TEXT DEFAULT ''"),
            ("contract_duration",     "TEXT DEFAULT ''"),
            ("salary",                "TEXT DEFAULT ''"),
            ("contract_start_date",   "TEXT DEFAULT ''"),
            ("notice_period",         "TEXT DEFAULT '0'"),
            ("contract_signing_date", "TEXT DEFAULT ''"),
        ]
        for col, dtype in inst_cols:
            if col not in inst_existing:
                conn.execute(f"ALTER TABLE instructors ADD COLUMN {col} {dtype}")

        # عمود الولاية في جدول school_info
        cur3 = conn.execute("PRAGMA table_info(school_info)")
        school_existing = {row[1] for row in cur3.fetchall()}
        if "wilaya" not in school_existing:
            conn.execute("ALTER TABLE school_info ADD COLUMN wilaya TEXT DEFAULT ''")
        if "manager_name" not in school_existing:
            conn.execute("ALTER TABLE school_info ADD COLUMN manager_name TEXT DEFAULT ''")
        _school_new = [
            ("accreditation_date",       "TEXT DEFAULT ''"),
            ("address_commune",          "TEXT DEFAULT ''"),
            ("address_daira",            "TEXT DEFAULT ''"),
            ("owner_name",               "TEXT DEFAULT ''"),
            ("owner_birth_date",         "TEXT DEFAULT ''"),
            ("owner_birth_place",        "TEXT DEFAULT ''"),
            ("owner_email",              "TEXT DEFAULT ''"),
            ("representative_name",      "TEXT DEFAULT ''"),
            ("representative_birth_date","TEXT DEFAULT ''"),
            ("representative_birth_place","TEXT DEFAULT ''"),
        ]
        for _col, _dtype in _school_new:
            if _col not in school_existing:
                conn.execute(f"ALTER TABLE school_info ADD COLUMN {_col} {_dtype}")

        # عمود نوع المركبة في جدول vehicles
        cur4 = conn.execute("PRAGMA table_info(vehicles)")
        veh_existing = {row[1] for row in cur4.fetchall()}
        if "vehicle_type" not in veh_existing:
            conn.execute(
                "ALTER TABLE vehicles ADD COLUMN vehicle_type TEXT DEFAULT 'سيارة'"
            )
        if "training_card_number" not in veh_existing:
            conn.execute(
                "ALTER TABLE vehicles ADD COLUMN training_card_number TEXT DEFAULT ''"
            )

        # جدول الإعدادات العامة (مفتاح/قيمة) — مخزن اللغة وغيرها
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT DEFAULT ''
            )
        """)
        # ترحيل اللغة من school_info إلى settings إن وُجدت
        if "language" in school_existing:
            migrated = conn.execute(
                "SELECT language FROM school_info WHERE id=1"
            ).fetchone()
            if migrated and migrated[0] in ("ar", "fr"):
                conn.execute(
                    "INSERT OR IGNORE INTO settings (key, value) VALUES ('language', ?)",
                    (migrated[0],)
                )
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'ar')"
        )

        # جدول محاولات الامتحانات (جديد)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS exam_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_id INTEGER NOT NULL,
                stage_type TEXT NOT NULL,
                exam_date TEXT DEFAULT (date('now')),
                score REAL DEFAULT 0,
                result TEXT DEFAULT 'راسب',
                notes TEXT DEFAULT '',
                FOREIGN KEY (candidate_id) REFERENCES candidates(id)
            )
        """)

        # جدول المستخدمين (نظام الدخول)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'trainer',
                full_name TEXT DEFAULT '',
                permissions TEXT DEFAULT '{}'
            )
        """)

        # إنشاء حساب المدير الافتراضي إن لم يوجد
        existing_admin = conn.execute(
            "SELECT id FROM users WHERE username='midanic'"
        ).fetchone()
        if not existing_admin:
            admin_hash = hashlib.sha256(b"admin123").hexdigest()
            conn.execute(
                """INSERT INTO users (username, password_hash, role, full_name, permissions)
                   VALUES ('midanic', ?, 'admin', 'مدير النظام', '{}')""",
                (admin_hash,)
            )

        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()


def get_language() -> str:
    """يقرأ اللغة المحفوظة في جدول settings (ar أو fr)."""
    try:
        conn = get_connection()
        row = conn.execute(
            "SELECT value FROM settings WHERE key='language'"
        ).fetchone()
        conn.close()
        if row and row[0] in ("ar", "fr"):
            return row[0]
    except Exception:
        pass
    return "ar"


def set_language(lang: str):
    """يحفظ اللغة في جدول settings ويحدّث المتغيّر العام LANG.
    لا تُعيد تشغيل البرنامج — الواجهة تُعاد بناؤها في نفس العملية."""
    global LANG
    try:
        conn = get_connection()
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('language', ?)",
            (lang,)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass
    LANG = lang


def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS school_info (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            name TEXT DEFAULT '', commercial_register TEXT DEFAULT '',
            accreditation_number TEXT DEFAULT '', nif TEXT DEFAULT '',
            nis TEXT DEFAULT '', article_number TEXT DEFAULT '',
            address TEXT DEFAULT '', phone TEXT DEFAULT ''
        );
        INSERT OR IGNORE INTO school_info (id) VALUES (1);

        CREATE TABLE IF NOT EXISTS instructors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL, last_name TEXT NOT NULL,
            gender TEXT DEFAULT '', birth_date TEXT DEFAULT '',
            birth_place TEXT DEFAULT '',
            phone TEXT DEFAULT '', address TEXT DEFAULT '',
            license_number TEXT DEFAULT '', license_date TEXT DEFAULT '',
            categories TEXT DEFAULT '', experience_years INTEGER DEFAULT 0,
            contract_duration TEXT DEFAULT '', salary TEXT DEFAULT '',
            contract_start_date TEXT DEFAULT '', notice_period TEXT DEFAULT '0',
            contract_signing_date TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL, last_name TEXT NOT NULL,
            gender TEXT DEFAULT '', birth_date TEXT DEFAULT '',
            birth_place_commune TEXT DEFAULT '', birth_place_wilaya TEXT DEFAULT '',
            marital_status TEXT DEFAULT '', father_name TEXT DEFAULT '',
            mother_name TEXT DEFAULT '', phone TEXT DEFAULT '',
            nationality TEXT DEFAULT 'جزائرية', disability TEXT DEFAULT '',
            blood_type TEXT DEFAULT '', license_type TEXT DEFAULT 'B',
            previous_licenses TEXT DEFAULT '', instructor_id INTEGER,
            total_amount REAL DEFAULT 0,
            registration_date TEXT DEFAULT (date('now')),
            national_id TEXT DEFAULT '',
            second_nationality TEXT DEFAULT '',
            current_address TEXT DEFAULT '',
            is_born_abroad INTEGER DEFAULT 0,
            birth_country TEXT DEFAULT 'الجزائر',
            embassy TEXT DEFAULT '',
            consulate TEXT DEFAULT '',
            FOREIGN KEY (instructor_id) REFERENCES instructors(id)
        );

        CREATE TABLE IF NOT EXISTS training_stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL, stage_type TEXT NOT NULL,
            status TEXT DEFAULT 'لم يبدأ', start_date TEXT DEFAULT '',
            end_date TEXT DEFAULT '', score REAL DEFAULT 0, notes TEXT DEFAULT '',
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        );

        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL, date TEXT DEFAULT (date('now')),
            amount REAL NOT NULL, payment_method TEXT DEFAULT 'نقدي',
            notes TEXT DEFAULT '',
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_type TEXT NOT NULL, amount REAL NOT NULL,
            date TEXT DEFAULT (date('now')), notes TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL, plate_number TEXT DEFAULT '',
            insurance_expiry TEXT DEFAULT '', tech_inspection_expiry TEXT DEFAULT '',
            notes TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            instructor_id INTEGER NOT NULL,
            vehicle_id INTEGER,
            session_date TEXT NOT NULL,
            session_time TEXT NOT NULL DEFAULT '08:00',
            duration INTEGER NOT NULL DEFAULT 60,
            session_type TEXT DEFAULT 'كرينو',
            notes TEXT DEFAULT '',
            FOREIGN KEY (candidate_id) REFERENCES candidates(id),
            FOREIGN KEY (instructor_id) REFERENCES instructors(id),
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        );

        CREATE TABLE IF NOT EXISTS exam_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            exam_type TEXT NOT NULL,
            exam_date TEXT DEFAULT (date('now')),
            result TEXT NOT NULL,
            score REAL DEFAULT 0,
            notes TEXT DEFAULT '',
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        );

        CREATE TABLE IF NOT EXISTS exam_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            stage_type TEXT NOT NULL,
            exam_date TEXT DEFAULT (date('now')),
            score REAL DEFAULT 0,
            result TEXT DEFAULT 'راسب',
            notes TEXT DEFAULT '',
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'trainer',
            full_name TEXT DEFAULT '',
            permissions TEXT DEFAULT '{}'
        );

    """)
    conn.commit()
    conn.close()


def seed_demo_data():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM instructors")
    if c.fetchone()[0] > 0:
        conn.close()
        return

    c.execute("""UPDATE school_info SET name='مدرسة النجاح لتعليم السياقة',
        commercial_register='12345678', accreditation_number='AGR-2020-001',
        nif='000312345678901', nis='120312345678901', article_number='12345678910',
        address='شارع الاستقلال، الجزائر العاصمة', phone='021000000' WHERE id=1""")

    c.execute("""INSERT INTO instructors (first_name,last_name,gender,birth_date,phone,address,
        license_number,license_date,categories,experience_years) VALUES
        ('أحمد','بن علي','ذكر','1980-05-15','0551000001','حي السلام، الجزائر',
         'DZ12345','2005-01-10','B,C',10)""")
    c.execute("""INSERT INTO instructors (first_name,last_name,gender,birth_date,phone,address,
        license_number,license_date,categories,experience_years) VALUES
        ('فاطمة','زهراء','أنثى','1985-09-20','0661000002','حي النور، الجزائر',
         'DZ67890','2010-06-01','A,B',8)""")

    c.execute("""INSERT INTO candidates (first_name,last_name,gender,birth_date,
        birth_place_commune,birth_place_wilaya,marital_status,father_name,mother_name,phone,
        nationality,blood_type,license_type,instructor_id,total_amount,registration_date) VALUES
        ('محمد','بوزيد','ذكر','2000-03-10','باب الوادي','الجزائر','أعزب','علي','خديجة بوزيد',
         '0771000001','جزائرية','A+','B',1,25000,'2024-01-15')""")
    c.execute("""INSERT INTO candidates (first_name,last_name,gender,birth_date,
        birth_place_commune,birth_place_wilaya,marital_status,father_name,mother_name,phone,
        nationality,blood_type,license_type,instructor_id,total_amount,registration_date) VALUES
        ('سارة','حمدي','أنثى','1998-07-22','الحراش','الجزائر','أعزب','كريم','نادية حمدي',
         '0661000003','جزائرية','B+','B',2,25000,'2024-02-01')""")

    for cid, stages in [(1, [('code','ناجح','2024-01-20',18),
                              ('creneau','قيد التكوين','2024-02-01',0),
                              ('circuit','لم يبدأ','',0)]),
                        (2, [('code','ناجح','2024-02-05',17),
                              ('creneau','لم يبدأ','',0),
                              ('circuit','لم يبدأ','',0)])]:
        for stype, status, sdate, score in stages:
            c.execute("""INSERT INTO training_stages
                (candidate_id,stage_type,status,start_date,score) VALUES (?,?,?,?,?)""",
                (cid, stype, status, sdate, score))

    for cid, d_, amt, method, note in [(1,'2024-01-15',15000,'نقدي','دفعة أولى'),
                                        (1,'2024-02-15',10000,'نقدي','دفعة ثانية'),
                                        (2,'2024-02-01',25000,'تحويل بنكي','دفعة كاملة')]:
        c.execute("""INSERT INTO payments
            (candidate_id,date,amount,payment_method,notes) VALUES (?,?,?,?,?)""",
            (cid, d_, amt, method, note))

    for etype, amt, d_, note in [('وقود',5000,'2024-01-31','وقود السيارات التدريبية'),
                                  ('صيانة',12000,'2024-02-10','صيانة دورية للسيارات'),
                                  ('كراء',30000,'2024-02-01','إيجار المقر')]:
        c.execute("INSERT INTO expenses (expense_type,amount,date,notes) VALUES (?,?,?,?)",
                  (etype, amt, d_, note))

    conn.commit()
    conn.close()


# ============================================================================
#  طبقة الوصول إلى قاعدة البيانات
# ============================================================================

class SchoolInfoDB:
    @staticmethod
    def get():
        conn = get_connection()
        row = conn.execute("SELECT * FROM school_info WHERE id=1").fetchone()
        conn.close()
        return dict(row) if row else {}

    @staticmethod
    def update(d):
        conn = get_connection()
        conn.execute("""UPDATE school_info SET name=?,commercial_register=?,
            accreditation_number=?,nif=?,nis=?,article_number=?,address=?,phone=?,wilaya=?,
            manager_name=?,accreditation_date=?,address_commune=?,address_daira=?,
            owner_name=?,owner_birth_date=?,owner_birth_place=?,owner_email=?,
            representative_name=?,representative_birth_date=?,representative_birth_place=?
            WHERE id=1""",
            (d['name'], d['commercial_register'], d['accreditation_number'],
             d['nif'], d['nis'], d['article_number'], d['address'], d['phone'],
             d.get('wilaya', ''), d.get('manager_name', ''),
             d.get('accreditation_date', ''), d.get('address_commune', ''),
             d.get('address_daira', ''), d.get('owner_name', ''),
             d.get('owner_birth_date', ''), d.get('owner_birth_place', ''),
             d.get('owner_email', ''), d.get('representative_name', ''),
             d.get('representative_birth_date', ''),
             d.get('representative_birth_place', '')))
        conn.commit()
        conn.close()


class InstructorDB:
    @staticmethod
    def get_all(search=""):
        conn = get_connection()
        if search:
            rows = conn.execute("""SELECT * FROM instructors
                WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?""",
                (f"%{search}%",) * 3).fetchall()
        else:
            rows = conn.execute("SELECT * FROM instructors ORDER BY last_name").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get(i):
        conn = get_connection()
        row = conn.execute("SELECT * FROM instructors WHERE id=?", (i,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def add(d):
        conn = get_connection()
        conn.execute("""INSERT INTO instructors (first_name,last_name,gender,birth_date,birth_place,phone,
            address,license_number,license_date,categories,experience_years,
            contract_duration, salary, contract_start_date, notice_period, contract_signing_date)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (d['first_name'], d['last_name'], d['gender'], d['birth_date'], d.get('birth_place',''), d['phone'],
             d['address'], d['license_number'], d['license_date'], d['categories'],
             d['experience_years'], d.get('contract_duration',''), d.get('salary',''),
             d.get('contract_start_date',''), d.get('notice_period','0'), d.get('contract_signing_date','')))
        conn.commit()
        conn.close()

    @staticmethod
    def update(i, d):
        conn = get_connection()
        conn.execute("""UPDATE instructors SET first_name=?,last_name=?,gender=?,birth_date=?,
            birth_place=?,phone=?,address=?,license_number=?,license_date=?,categories=?,experience_years=?,
            contract_duration=?, salary=?, contract_start_date=?, notice_period=?, contract_signing_date=?
            WHERE id=?""", (d['first_name'], d['last_name'], d['gender'], d['birth_date'],
            d.get('birth_place',''), d['phone'], d['address'], d['license_number'], d['license_date'],
            d['categories'], d['experience_years'], d.get('contract_duration',''), d.get('salary',''),
            d.get('contract_start_date',''), d.get('notice_period','0'), d.get('contract_signing_date',''), i))
        conn.commit()
        conn.close()

    @staticmethod
    def delete(i):
        conn = get_connection()
        conn.execute("DELETE FROM instructors WHERE id=?", (i,))
        conn.commit()
        conn.close()


class CandidateDB:
    @staticmethod
    def get_all(search=""):
        _NOT_GRAD = """NOT (
            (c.license_type='A1' AND
             (SELECT COUNT(*) FROM training_stages ts
              WHERE ts.candidate_id=c.id AND ts.stage_type='code' AND ts.status='ناجح')>=1)
            OR
            (c.license_type!='A1' AND
             (SELECT COUNT(DISTINCT ts.stage_type) FROM training_stages ts
              WHERE ts.candidate_id=c.id AND ts.status='ناجح'
              AND ts.stage_type IN ('code','creneau','circuit'))>=3)
        )"""
        conn = get_connection()
        base = (f"SELECT c.*, i.first_name||' '||i.last_name as instructor_name "
                f"FROM candidates c LEFT JOIN instructors i ON c.instructor_id=i.id "
                f"WHERE {_NOT_GRAD}")
        if search:
            rows = conn.execute(
                base + " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)",
                (f"%{search}%",) * 3).fetchall()
        else:
            rows = conn.execute(base + " ORDER BY c.last_name").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_graduates(search=""):
        """المترشحون المتخرجون: A1 بعد الكود، وباقي الأصناف بعد الثلاث مراحل."""
        _GRAD = """(
            (c.license_type='A1' AND
             (SELECT COUNT(*) FROM training_stages ts
              WHERE ts.candidate_id=c.id AND ts.stage_type='code' AND ts.status='ناجح')>=1)
            OR
            (c.license_type!='A1' AND
             (SELECT COUNT(DISTINCT ts.stage_type) FROM training_stages ts
              WHERE ts.candidate_id=c.id AND ts.status='ناجح'
              AND ts.stage_type IN ('code','creneau','circuit'))>=3)
        )"""
        conn = get_connection()
        base = (f"SELECT c.*, i.first_name||' '||i.last_name as instructor_name "
                f"FROM candidates c LEFT JOIN instructors i ON c.instructor_id=i.id "
                f"WHERE {_GRAD}")
        if search:
            rows = conn.execute(
                base + " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)",
                (f"%{search}%",) * 3).fetchall()
        else:
            rows = conn.execute(base + " ORDER BY c.last_name").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_by_date_range(d_from="", d_to=""):
        """يجلب المترشحين المسجلين ضمن فترة زمنية (حسب registration_date)."""
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("c.registration_date >= ?"); params.append(d_from)
        if d_to:   conds.append("c.registration_date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        rows = conn.execute(
            f"SELECT c.*, i.first_name||' '||i.last_name as instructor_name "
            f"FROM candidates c LEFT JOIN instructors i ON c.instructor_id=i.id "
            f"{where} ORDER BY c.last_name", params).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def count_in_range(d_from="", d_to=""):
        """يحسب عدد المترشحين المسجلين في الفترة."""
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("registration_date >= ?"); params.append(d_from)
        if d_to:   conds.append("registration_date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        row = conn.execute(f"SELECT COUNT(*) as c FROM candidates {where}", params).fetchone()
        conn.close()
        return row['c'] if row else 0

    @staticmethod
    def get(i):
        conn = get_connection()
        row = conn.execute("SELECT * FROM candidates WHERE id=?", (i,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def add(d):
        conn = get_connection()
        conn.execute("""INSERT INTO candidates (first_name,last_name,gender,birth_date,
            birth_place_commune,birth_place_wilaya,marital_status,father_name,mother_name,phone,
            nationality,disability,blood_type,license_type,previous_licenses,instructor_id,
            total_amount,national_id,second_nationality,current_address,is_born_abroad,
            birth_country,embassy,consulate,file_number,file_date,address_commune,address_wilaya,
            last_name_fr,first_name_fr,insurance_number,email,
            guardian_first_name,guardian_last_name,guardian_birth_date,
            guardian_address,guardian_phone)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (d['first_name'], d['last_name'], d['gender'], d['birth_date'],
             d['birth_place_commune'], d['birth_place_wilaya'], d['marital_status'],
             d['father_name'], d['mother_name'], d['phone'], d['nationality'],
             d['disability'], d['blood_type'], d['license_type'],
             d['previous_licenses'], d.get('instructor_id'), d['total_amount'],
             d.get('national_id',''), d.get('second_nationality',''),
             d.get('current_address',''), d.get('is_born_abroad',0),
             d.get('birth_country',''), d.get('embassy',''), d.get('consulate',''),
             d.get('file_number',''), d.get('file_date',''),
             d.get('address_commune',''), d.get('address_wilaya',''),
             d.get('last_name_fr',''), d.get('first_name_fr',''),
             d.get('insurance_number',''), d.get('email',''),
             d.get('guardian_first_name',''), d.get('guardian_last_name',''),
             d.get('guardian_birth_date',''), d.get('guardian_address',''),
             d.get('guardian_phone','')))
        lid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.execute("INSERT INTO training_stages (candidate_id,stage_type) VALUES (?,?)",
                     (lid, 'code'))
        conn.commit()
        conn.close()
        return lid

    @staticmethod
    def update(i, d):
        conn = get_connection()
        conn.execute("""UPDATE candidates SET first_name=?,last_name=?,gender=?,birth_date=?,
            birth_place_commune=?,birth_place_wilaya=?,marital_status=?,father_name=?,
            mother_name=?,phone=?,nationality=?,disability=?,blood_type=?,license_type=?,
            previous_licenses=?,instructor_id=?,total_amount=?,national_id=?,
            second_nationality=?,current_address=?,is_born_abroad=?,birth_country=?,
            embassy=?,consulate=?,file_number=?,file_date=?,address_commune=?,address_wilaya=?,
            last_name_fr=?,first_name_fr=?,insurance_number=?,email=?,
            guardian_first_name=?,guardian_last_name=?,guardian_birth_date=?,
            guardian_address=?,guardian_phone=?
            WHERE id=?""",
            (d['first_name'], d['last_name'], d['gender'], d['birth_date'],
             d['birth_place_commune'], d['birth_place_wilaya'], d['marital_status'],
             d['father_name'], d['mother_name'], d['phone'], d['nationality'],
             d['disability'], d['blood_type'], d['license_type'],
             d['previous_licenses'], d.get('instructor_id'), d['total_amount'],
             d.get('national_id',''), d.get('second_nationality',''),
             d.get('current_address',''), d.get('is_born_abroad',0),
             d.get('birth_country',''), d.get('embassy',''),
             d.get('consulate',''), d.get('file_number',''), d.get('file_date',''),
             d.get('address_commune',''), d.get('address_wilaya',''),
             d.get('last_name_fr',''), d.get('first_name_fr',''),
             d.get('insurance_number',''), d.get('email',''),
             d.get('guardian_first_name',''), d.get('guardian_last_name',''),
             d.get('guardian_birth_date',''), d.get('guardian_address',''),
             d.get('guardian_phone',''), i))
        conn.commit()
        conn.close()

    @staticmethod
    def delete(i):
        conn = get_connection()
        conn.execute("DELETE FROM training_stages WHERE candidate_id=?", (i,))
        conn.execute("DELETE FROM payments WHERE candidate_id=?", (i,))
        conn.execute("DELETE FROM exam_results WHERE candidate_id=?", (i,))
        conn.execute("DELETE FROM sessions WHERE candidate_id=?", (i,))
        conn.execute("DELETE FROM candidates WHERE id=?", (i,))
        conn.commit()
        conn.close()


class TrainingDB:
    @staticmethod
    def get_by_candidate(cid):
        conn = get_connection()
        rows = conn.execute("SELECT * FROM training_stages WHERE candidate_id=?",
                            (cid,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def add(cid, stage_type):
        conn = get_connection()
        conn.execute("INSERT INTO training_stages (candidate_id,stage_type) VALUES (?,?)",
                     (cid, stage_type))
        conn.commit()
        conn.close()

    @staticmethod
    def update(i, d):
        conn = get_connection()
        conn.execute("""UPDATE training_stages SET status=?,start_date=?,end_date=?,
            score=?,notes=? WHERE id=?""",
            (d['status'], d['start_date'], d['end_date'], d['score'], d['notes'], i))
        conn.commit()
        conn.close()

    @staticmethod
    def get_stats():
        conn = get_connection()
        rows = conn.execute("""
            SELECT stage_type, result as status, COUNT(*) as count 
            FROM exam_attempts 
            GROUP BY stage_type, result
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]


class ExamAttemptsDB:
    @staticmethod
    def get_by_candidate(cid):
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM exam_attempts WHERE candidate_id=? ORDER BY stage_type, exam_date",
            (cid,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_by_candidate_and_stage(cid, stage_type):
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM exam_attempts WHERE candidate_id=? AND stage_type=? ORDER BY exam_date",
            (cid, stage_type)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def add(d):
        conn = get_connection()
        conn.execute("""INSERT INTO exam_attempts
            (candidate_id, stage_type, exam_date, score, result, notes)
            VALUES (?,?,?,?,?,?)""",
            (d['candidate_id'], d['stage_type'], d['exam_date'],
             d['score'], d['result'], d['notes']))
        conn.commit()
        conn.close()

    @staticmethod
    def delete(i):
        conn = get_connection()
        conn.execute("DELETE FROM exam_attempts WHERE id=?", (i,))
        conn.commit()
        conn.close()

    @staticmethod
    def get_stats_by_stage():
        conn = get_connection()
        rows = conn.execute("""
            SELECT stage_type,
                   COUNT(*) as total,
                   SUM(CASE WHEN result='ناجح' THEN 1 ELSE 0 END) as passed
            FROM exam_attempts
            GROUP BY stage_type
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]


class PaymentDB:
    @staticmethod
    def get_by_candidate(cid):
        conn = get_connection()
        rows = conn.execute("SELECT * FROM payments WHERE candidate_id=? ORDER BY date DESC",
                            (cid,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_total_by_candidate(cid):
        conn = get_connection()
        row = conn.execute("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE candidate_id=?",
                           (cid,)).fetchone()
        conn.close()
        return row['t'] if row else 0

    @staticmethod
    def add(d):
        conn = get_connection()
        conn.execute("""INSERT INTO payments (candidate_id,date,amount,payment_method,notes)
            VALUES (?,?,?,?,?)""",
            (d['candidate_id'], d['date'], d['amount'], d['payment_method'], d['notes']))
        conn.commit()
        conn.close()

    @staticmethod
    def delete(i):
        conn = get_connection()
        conn.execute("DELETE FROM payments WHERE id=?", (i,))
        conn.commit()
        conn.close()

    @staticmethod
    def get_total_by_month(y, m):
        conn = get_connection()
        row = conn.execute("""SELECT COALESCE(SUM(amount),0) as t FROM payments
            WHERE strftime('%Y',date)=? AND strftime('%m',date)=?""",
            (str(y), f"{m:02d}")).fetchone()
        conn.close()
        return row['t'] if row else 0

    @staticmethod
    def get_total_by_year(y):
        conn = get_connection()
        row = conn.execute("""SELECT COALESCE(SUM(amount),0) as t FROM payments
            WHERE strftime('%Y',date)=?""", (str(y),)).fetchone()
        conn.close()
        return row['t'] if row else 0

    @staticmethod
    def get_monthly_breakdown(y):
        conn = get_connection()
        rows = conn.execute("""SELECT strftime('%m',date) as month,
            COALESCE(SUM(amount),0) as total FROM payments
            WHERE strftime('%Y',date)=? GROUP BY month ORDER BY month""",
            (str(y),)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_total_in_range(d_from="", d_to=""):
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("date >= ?"); params.append(d_from)
        if d_to:   conds.append("date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        row = conn.execute(
            f"SELECT COALESCE(SUM(amount),0) as t FROM payments {where}", params).fetchone()
        conn.close()
        return row['t'] if row else 0

    @staticmethod
    def get_monthly_breakdown_range(d_from="", d_to=""):
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("date >= ?"); params.append(d_from)
        if d_to:   conds.append("date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        rows = conn.execute(
            f"SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount),0) as total "
            f"FROM payments {where} GROUP BY month ORDER BY month", params).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_paid_per_candidate_in_range(d_from="", d_to=""):
        """يُعيد قاموساً {candidate_id: مجموع_المدفوعات} ضمن الفترة."""
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("date >= ?"); params.append(d_from)
        if d_to:   conds.append("date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        rows = conn.execute(
            f"SELECT candidate_id, COALESCE(SUM(amount),0) as total "
            f"FROM payments {where} GROUP BY candidate_id", params).fetchall()
        conn.close()
        return {r['candidate_id']: r['total'] for r in rows}


class ExpenseDB:
    @staticmethod
    def get_all(search=""):
        conn = get_connection()
        if search:
            rows = conn.execute("""SELECT * FROM expenses
                WHERE expense_type LIKE ? OR notes LIKE ? ORDER BY date DESC""",
                (f"%{search}%", f"%{search}%")).fetchall()
        else:
            rows = conn.execute("SELECT * FROM expenses ORDER BY date DESC").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_all_in_range(d_from="", d_to=""):
        """يجلب المصاريف ضمن فترة زمنية محددة."""
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("date >= ?"); params.append(d_from)
        if d_to:   conds.append("date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        rows = conn.execute(f"SELECT * FROM expenses {where} ORDER BY date DESC", params).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def add(d):
        conn = get_connection()
        conn.execute("INSERT INTO expenses (expense_type,amount,date,notes) VALUES (?,?,?,?)",
                     (d['expense_type'], d['amount'], d['date'], d['notes']))
        conn.commit()
        conn.close()

    @staticmethod
    def update(i, d):
        conn = get_connection()
        conn.execute("UPDATE expenses SET expense_type=?,amount=?,date=?,notes=? WHERE id=?",
                     (d['expense_type'], d['amount'], d['date'], d['notes'], i))
        conn.commit()
        conn.close()

    @staticmethod
    def delete(i):
        conn = get_connection()
        conn.execute("DELETE FROM expenses WHERE id=?", (i,))
        conn.commit()
        conn.close()

    @staticmethod
    def get_total_by_month(y, m):
        conn = get_connection()
        row = conn.execute("""SELECT COALESCE(SUM(amount),0) as t FROM expenses
            WHERE strftime('%Y',date)=? AND strftime('%m',date)=?""",
            (str(y), f"{m:02d}")).fetchone()
        conn.close()
        return row['t'] if row else 0

    @staticmethod
    def get_total_by_year(y):
        conn = get_connection()
        row = conn.execute("""SELECT COALESCE(SUM(amount),0) as t FROM expenses
            WHERE strftime('%Y',date)=?""", (str(y),)).fetchone()
        conn.close()
        return row['t'] if row else 0

    @staticmethod
    def get_monthly_breakdown(y):
        conn = get_connection()
        rows = conn.execute("""SELECT strftime('%m',date) as month,
            COALESCE(SUM(amount),0) as total FROM expenses
            WHERE strftime('%Y',date)=? GROUP BY month ORDER BY month""",
            (str(y),)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_total_in_range(d_from="", d_to=""):
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("date >= ?"); params.append(d_from)
        if d_to:   conds.append("date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        row = conn.execute(
            f"SELECT COALESCE(SUM(amount),0) as t FROM expenses {where}", params).fetchone()
        conn.close()
        return row['t'] if row else 0

    @staticmethod
    def get_monthly_breakdown_range(d_from="", d_to=""):
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("date >= ?"); params.append(d_from)
        if d_to:   conds.append("date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        rows = conn.execute(
            f"SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount),0) as total "
            f"FROM expenses {where} GROUP BY month ORDER BY month", params).fetchall()
        conn.close()
        return [dict(r) for r in rows]


class VehicleDB:
    @staticmethod
    def get_all():
        conn = get_connection()
        rows = conn.execute("SELECT * FROM vehicles").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_alerts():
        conn = get_connection()
        today = date.today().strftime('%Y-%m-%d')
        rows = conn.execute("""
            SELECT * FROM vehicles 
            WHERE insurance_expiry <= date(?, '+15 days')
            OR tech_inspection_expiry <= date(?, '+15 days')
        """, (today, today)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def add(data: dict):
        conn = get_connection()
        conn.execute(
            """INSERT INTO vehicles
               (vehicle_type, model, plate_number,
                insurance_expiry, tech_inspection_expiry, notes,
                training_card_number)
               VALUES (?,?,?,?,?,?,?)""",
            (data.get("vehicle_type", "سيارة"),
             data.get("model", ""),
             data.get("plate_number", ""),
             data.get("insurance_expiry", ""),
             data.get("tech_inspection_expiry", ""),
             data.get("notes", ""),
             data.get("training_card_number", ""))
        )
        conn.commit()
        conn.close()

    @staticmethod
    def update(vid: int, data: dict):
        conn = get_connection()
        conn.execute(
            """UPDATE vehicles SET
               vehicle_type=?, model=?, plate_number=?,
               insurance_expiry=?, tech_inspection_expiry=?, notes=?,
               training_card_number=?
               WHERE id=?""",
            (data.get("vehicle_type", "سيارة"),
             data.get("model", ""),
             data.get("plate_number", ""),
             data.get("insurance_expiry", ""),
             data.get("tech_inspection_expiry", ""),
             data.get("notes", ""),
             data.get("training_card_number", ""),
             vid)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete(vid: int):
        conn = get_connection()
        conn.execute("DELETE FROM vehicles WHERE id=?", (vid,))
        conn.commit()
        conn.close()


class SessionDB:
    """طبقة الوصول لجدول الحصص التدريبية."""

    @staticmethod
    def get_all(date_filter="", instructor_id=None, candidate_id=None):
        conn = get_connection()
        sql = """
            SELECT s.*,
                   c.first_name||' '||c.last_name  AS candidate_name,
                   i.first_name||' '||i.last_name  AS instructor_name
            FROM sessions s
            JOIN candidates  c ON s.candidate_id  = c.id
            JOIN instructors i ON s.instructor_id  = i.id
            WHERE 1=1
        """
        params = []
        if date_filter:
            sql += " AND s.session_date = ?"
            params.append(date_filter)
        if instructor_id:
            sql += " AND s.instructor_id = ?"
            params.append(instructor_id)
        if candidate_id:
            sql += " AND s.candidate_id = ?"
            params.append(candidate_id)
        sql += " ORDER BY s.session_date, s.session_time"
        rows = conn.execute(sql, params).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_today():
        return SessionDB.get_all(date_filter=date.today().strftime('%Y-%m-%d'))

    @staticmethod
    def get_week():
        """حصص الأسبوع القادم (اليوم + 6 أيام)."""
        conn = get_connection()
        today = date.today().strftime('%Y-%m-%d')
        end   = (date.today() + timedelta(days=6)).strftime('%Y-%m-%d')
        rows  = conn.execute("""
            SELECT s.*,
                   c.first_name||' '||c.last_name  AS candidate_name,
                   i.first_name||' '||i.last_name  AS instructor_name
            FROM sessions s
            JOIN candidates  c ON s.candidate_id  = c.id
            JOIN instructors i ON s.instructor_id  = i.id
            WHERE s.session_date BETWEEN ? AND ?
            ORDER BY s.session_date, s.session_time
        """, (today, end)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get(sid):
        conn = get_connection()
        row = conn.execute("SELECT * FROM sessions WHERE id=?", (sid,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def add(d):
        conn = get_connection()
        conn.execute("""
            INSERT INTO sessions
                (candidate_id, instructor_id, vehicle_id, session_date, session_time,
                 duration, session_type, notes)
            VALUES (?,?,?,?,?,?,?,?)""",
            (d['candidate_id'], d['instructor_id'], d.get('vehicle_id'),
             d['session_date'], d['session_time'], d['duration'],
             d.get('session_type', 'كرينو'), d.get('notes', '')))
        conn.commit()
        conn.close()

    @staticmethod
    def update(sid, d):
        conn = get_connection()
        conn.execute("""
            UPDATE sessions SET candidate_id=?, instructor_id=?, vehicle_id=?,
                session_date=?, session_time=?, duration=?,
                session_type=?, notes=?
            WHERE id=?""",
            (d['candidate_id'], d['instructor_id'], d.get('vehicle_id'),
             d['session_date'], d['session_time'], d['duration'],
             d.get('session_type', 'كرينو'), d.get('notes', ''), sid))
        conn.commit()
        conn.close()

    @staticmethod
    def delete(sid):
        conn = get_connection()
        conn.execute("DELETE FROM sessions WHERE id=?", (sid,))
        conn.commit()
        conn.close()

    @staticmethod
    def _overlapping(rows, session_time, duration):
        """يُعيد قائمة الصفوف المتعارضة زمنياً."""
        try:
            new_start = datetime.strptime(session_time, "%H:%M")
            new_end   = new_start + timedelta(minutes=int(duration))
        except Exception:
            return []
        conflicts = []
        for r in rows:
            try:
                ex_start = datetime.strptime(r['session_time'], "%H:%M")
                ex_end   = ex_start + timedelta(minutes=int(r['duration']))
                if new_start < ex_end and new_end > ex_start:
                    conflicts.append(dict(r))
            except Exception:
                pass
        return conflicts


    @staticmethod
    def check_conflict(instructor_id, session_date, session_time, duration,
                       vehicle_id=None, exclude_id=None):
        """يبحث عن تعارض زمني للممرّن وكذلك للمركبة (إن وُجدت)."""
        conn = get_connection()
        # استعلام الممرّن
        inst_rows = conn.execute("""
            SELECT * FROM sessions
            WHERE instructor_id=? AND session_date=?
              AND id != COALESCE(?,0)
        """, (instructor_id, session_date, exclude_id or 0)).fetchall()

        # استعلام المركبة (إن اختيرت)
        veh_rows = []
        if vehicle_id:
            veh_rows = conn.execute("""
                SELECT * FROM sessions
                WHERE vehicle_id=? AND session_date=?
                  AND id != COALESCE(?,0)
            """, (vehicle_id, session_date, exclude_id or 0)).fetchall()
        conn.close()

        inst_conflicts = SessionDB._overlapping(
            [dict(r) for r in inst_rows], session_time, duration)
        veh_conflicts  = SessionDB._overlapping(
            [dict(r) for r in veh_rows],  session_time, duration)
        return inst_conflicts, veh_conflicts


SESSION_TYPE_OPTIONS = ["كرينو", "طريق", "كود (نظري)", "مناورة حرة"]
TIME_OPTIONS = [f"{h:02d}:{m:02d}" for h in range(7, 20) for m in (0, 30)]
DURATION_OPTIONS = ["30", "45", "60", "90", "120"]


class ExamResultDB:
    """طبقة الوصول لجدول نتائج الامتحانات."""

    @staticmethod
    def get_by_candidate(candidate_id):
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM exam_results WHERE candidate_id=? ORDER BY exam_date DESC",
            (candidate_id,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def add(d):
        conn = get_connection()
        conn.execute(
            """INSERT INTO exam_results
               (candidate_id, exam_type, exam_date, result, score, notes)
               VALUES (?,?,?,?,?,?)""",
            (d['candidate_id'], d['exam_type'], d['exam_date'],
             d['result'], d.get('score', 0), d.get('notes', ''))
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete(rid):
        conn = get_connection()
        conn.execute("DELETE FROM exam_results WHERE id=?", (rid,))
        conn.commit()
        conn.close()

    @staticmethod
    def get_pass_rate_by_type():
        """معدل النجاح لكل نوع امتحان (نظري / تطبيقي)."""
        conn = get_connection()
        rows = conn.execute("""
            SELECT exam_type,
                   COUNT(*) AS total,
                   SUM(CASE WHEN result='ناجح' THEN 1 ELSE 0 END) AS passed
            FROM exam_results
            GROUP BY exam_type
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_monthly_breakdown(year):
        """تفصيل شهري لنتائج الامتحانات في السنة المحددة."""
        conn = get_connection()
        rows = conn.execute("""
            SELECT strftime('%m', exam_date) AS month,
                   exam_type,
                   COUNT(*) AS total,
                   SUM(CASE WHEN result='ناجح' THEN 1 ELSE 0 END) AS passed
            FROM exam_results
            WHERE strftime('%Y', exam_date) = ?
            GROUP BY month, exam_type
            ORDER BY month
        """, (str(year),)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_pass_rate_in_range(d_from="", d_to=""):
        """معدل النجاح لكل نوع امتحان ضمن فترة زمنية."""
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("exam_date >= ?"); params.append(d_from)
        if d_to:   conds.append("exam_date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        rows = conn.execute(
            f"SELECT exam_type, COUNT(*) AS total, "
            f"SUM(CASE WHEN result='ناجح' THEN 1 ELSE 0 END) AS passed "
            f"FROM exam_results {where} GROUP BY exam_type", params).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_monthly_breakdown_range(d_from="", d_to=""):
        """تفصيل شهري ضمن فترة زمنية (YYYY-MM)."""
        conn = get_connection()
        params = []; conds = []
        if d_from: conds.append("exam_date >= ?"); params.append(d_from)
        if d_to:   conds.append("exam_date <= ?"); params.append(d_to)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        rows = conn.execute(
            f"SELECT strftime('%Y-%m', exam_date) AS month, exam_type, COUNT(*) AS total, "
            f"SUM(CASE WHEN result='ناجح' THEN 1 ELSE 0 END) AS passed "
            f"FROM exam_results {where} GROUP BY month, exam_type ORDER BY month", params).fetchall()
        conn.close()
        return [dict(r) for r in rows]


class UserDB:
    """طبقة الوصول لجدول المستخدمين."""

    @staticmethod
    def _hash(password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    @staticmethod
    def _parse(row: dict) -> dict:
        try:
            row["permissions"] = json.loads(row.get("permissions") or "{}")
        except Exception:
            row["permissions"] = {}
        return row

    @staticmethod
    def authenticate(username: str, password: str):
        conn = get_connection()
        row = conn.execute(
            "SELECT * FROM users WHERE username=?", (username,)
        ).fetchone()
        conn.close()
        if not row:
            return None
        u = dict(row)
        if u["password_hash"] != UserDB._hash(password):
            return None
        return UserDB._parse(u)

    @staticmethod
    def get_all():
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM users ORDER BY role DESC, username"
        ).fetchall()
        conn.close()
        return [UserDB._parse(dict(r)) for r in rows]

    @staticmethod
    def get(uid):
        conn = get_connection()
        row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        conn.close()
        return UserDB._parse(dict(row)) if row else None

    @staticmethod
    def add(d: dict):
        conn = get_connection()
        perm = json.dumps(d.get("permissions", {}), ensure_ascii=False)
        conn.execute(
            """INSERT INTO users (username, password_hash, role, full_name, permissions)
               VALUES (?,?,?,?,?)""",
            (d["username"], UserDB._hash(d["password"]),
             d.get("role", "trainer"), d.get("full_name", ""), perm)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def update(uid, d: dict):
        conn = get_connection()
        perm = json.dumps(d.get("permissions", {}), ensure_ascii=False)
        conn.execute(
            "UPDATE users SET full_name=?, role=?, permissions=? WHERE id=?",
            (d.get("full_name", ""), d.get("role", "trainer"), perm, uid)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def change_password(uid, new_password: str):
        conn = get_connection()
        conn.execute(
            "UPDATE users SET password_hash=? WHERE id=?",
            (UserDB._hash(new_password), uid)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete(uid):
        conn = get_connection()
        conn.execute("DELETE FROM users WHERE id=?", (uid,))
        conn.commit()
        conn.close()

    @staticmethod
    def has_perm(user: dict, key: str) -> bool:
        """هل يملك المستخدم صلاحية معيّنة؟ admin لديه كل الصلاحيات دائماً."""
        if not user:
            return False
        if user.get("role") == "admin":
            return True
        return bool(user.get("permissions", {}).get(key, False))


# ============================================================================
#  مكونات الواجهة (UI Helpers)
# ============================================================================

def _clr_lighten(hex_color, amount=0.14):
    try:
        h = hex_color.lstrip("#")
        r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
        r = min(255, int(r + (255-r)*amount))
        g = min(255, int(g + (255-g)*amount))
        b = min(255, int(b + (255-b)*amount))
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return hex_color

def _clr_darken(hex_color, amount=0.18):
    try:
        h = hex_color.lstrip("#")
        r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
        r,g,b = int(r*(1-amount)), int(g*(1-amount)), int(b*(1-amount))
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return hex_color


class ModernButton(tk.Button):
    """زر عصري مسطّح (Flat) بتأثير hover وضغط ناعمَين."""
    def __init__(self, parent, text="", command=None, color=COLOR_PRIMARY,
                 fg="white", icon="", width=None, size="normal", **kw):
        display = f"{icon}  {text}" if icon else text
        if size == "large":
            pady_v, padx_v, font_f = 12, 24, (FONT_FAMILY, 12, "bold")
        elif size == "small":
            pady_v, padx_v, font_f = 4,  10, (FONT_FAMILY, 9,  "bold")
        else:
            pady_v, padx_v, font_f = 8,  18, FONT_BOLD

        super().__init__(parent, text=display, command=command, font=font_f,
                         bg=color, fg=fg, relief="flat", bd=0,
                         padx=padx_v, pady=pady_v, cursor="hand2",
                         activebackground=_clr_darken(color, 0.14),
                         activeforeground="white",
                         highlightthickness=0, **kw)
        if width:
            self.configure(width=width)
        self._c  = color
        self._h  = _clr_lighten(color, 0.14)
        self._p  = _clr_darken(color, 0.18)
        self.bind("<Enter>",          self._on_enter)
        self.bind("<Leave>",          self._on_leave)
        self.bind("<ButtonPress-1>",  self._on_press)
        self.bind("<ButtonRelease-1>",self._on_release)

    def _on_enter(self, e):   self.configure(bg=self._h)
    def _on_leave(self, e):   self.configure(bg=self._c)
    def _on_press(self, e):   self.configure(bg=self._p)
    def _on_release(self, e):
        inside = self.winfo_containing(e.x_root, e.y_root) == self
        self.configure(bg=self._h if inside else self._c)

    # للتوافق مع الكود القديم الذي يستدعي _lighten/_darken كـ static
    @staticmethod
    def _lighten(hex_color, amount=0.15): return _clr_lighten(hex_color, amount)
    @staticmethod
    def _darken(hex_color, amount=0.2):  return _clr_darken(hex_color, amount)


def confirm_delete(name=None):
    if name is None:
        name = T("lbl_this_item")
    return messagebox.askyesno(
        T("msg_confirm_del"),
        f"{T('msg_confirm_del_q')} {name}؟"
    )

def show_info(msg):  messagebox.showinfo(T("msg_success"), msg)
def show_error(msg): messagebox.showerror(T("msg_error"), msg)


def make_card(parent, padding=20):
    """بطاقة بيضاء بظل ناعم وزوايا احترافية."""
    outer = tk.Frame(parent, bg="#d1d9e6", padx=1, pady=1)
    mid   = tk.Frame(outer,  bg="#e8edf3", padx=1, pady=1)
    mid.pack(fill="both", expand=True)
    inner = tk.Frame(mid, bg=COLOR_CARD, padx=padding, pady=padding)
    inner.pack(fill="both", expand=True)
    return outer, inner


def section_title(parent, text, icon=""):
    """عنوان قسم مع أيقونة."""
    f = tk.Frame(parent, bg=COLOR_CARD)
    f.pack(fill="x", pady=(0, 12))
    lbl = tk.Label(f, text=f"{icon}  {text}" if icon else text,
                   font=(FONT_FAMILY, 13, "bold"), bg=COLOR_CARD,
                   fg=COLOR_PRIMARY, anchor=A())
    lbl.pack(side=S())
    line = tk.Frame(f, bg=COLOR_PRIMARY_LIGHT, height=2)
    line.pack(side=S(), fill="x", expand=True, padx=(10, 0), pady=(8, 0))
    return f


def make_label(parent, text, bg=COLOR_CARD, fg=COLOR_TEXT, font=None):
    return tk.Label(parent, text=text, bg=bg, fg=fg,
                    font=font or FONT_MAIN, anchor=A())


def make_entry(parent, textvariable, width=24):
    e = tk.Entry(parent, textvariable=textvariable, font=FONT_MAIN,
                 bd=0, relief="flat", bg=COLOR_INPUT_BG, fg=COLOR_TEXT,
                 insertbackground=COLOR_PRIMARY, highlightthickness=1,
                 highlightbackground=COLOR_BORDER,
                 highlightcolor=COLOR_PRIMARY, width=width)
    e.configure(justify=J())
    return e


def make_combo(parent, textvariable, values, width=22, state="readonly"):
    c = ttk.Combobox(parent, textvariable=textvariable, values=values,
                     font=FONT_MAIN, width=width, state=state,
                     style="Modern.TCombobox", justify=J())
    return c


def create_treeview(parent, columns, headings, widths=None, height=15):
    frame = tk.Frame(parent, bg=COLOR_CARD)
    frame.pack(fill="both", expand=True, padx=4, pady=4)
    tree = ttk.Treeview(frame, columns=columns, show="headings", height=height,
                        style="Modern.Treeview")
    for i, col in enumerate(columns):
        tree.heading(col, text=headings[i], anchor="center")
        tree.column(col, width=(widths[i] if widths else 120), anchor="center")
    vsb = ttk.Scrollbar(frame, orient="vertical",   command=tree.yview,
                        style="Thin.Vertical.TScrollbar")
    hsb = ttk.Scrollbar(frame, orient="horizontal", command=tree.xview,
                        style="Thin.Horizontal.TScrollbar")
    tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
    tree.grid(row=0, column=0, sticky="nsew")
    vsb.grid(row=0, column=1, sticky="ns")
    hsb.grid(row=1, column=0, sticky="ew")
    frame.grid_rowconfigure(0, weight=1)
    frame.grid_columnconfigure(0, weight=1)
    tree.tag_configure("oddrow",  background="#f8fafc")
    tree.tag_configure("evenrow", background=COLOR_CARD)
    return tree


def insert_zebra(tree, values_list):
    """يضيف صفوفاً للـ Treeview بألوان متناوبة."""
    for r in tree.get_children():
        tree.delete(r)
    for i, vals in enumerate(values_list):
        tag = "oddrow" if i % 2 else "evenrow"
        tree.insert("", "end", values=vals, tags=(tag,))


def stat_card(parent, title, value, icon, color, command=None):
    """بطاقة إحصائية ملونة قابلة للنقر."""
    hc = _clr_lighten(color, 0.12)
    card = tk.Frame(parent, bg=color, padx=20, pady=18,
                    cursor="hand2" if command else "")
    card.pack(side=S(), fill="both", expand=True, padx=6)
    top = tk.Frame(card, bg=color); top.pack(fill="x")
    icon_lbl = tk.Label(top, text=icon, font=(FONT_FAMILY, 26),
                        bg=color, fg="white"); icon_lbl.pack(side=S())
    title_lbl = tk.Label(top, text=title, font=(FONT_FAMILY, 10, "bold"),
                         bg=color, fg="white", anchor=A())
    title_lbl.pack(side=S(), padx=8)
    val_lbl = tk.Label(card, text=value, font=(FONT_FAMILY, 20, "bold"),
                       bg=color, fg="white", anchor=A())
    val_lbl.pack(fill="x", pady=(6, 0))
    if command:
        arr_lbl = tk.Label(card, text=T("dash_view_detail"),
                           font=(FONT_FAMILY, 8), bg=color, fg="white",
                           anchor=A()); arr_lbl.pack(fill="x", pady=(4, 0))
        all_w = [card, top, icon_lbl, title_lbl, val_lbl, arr_lbl]
        def _enter(e):
            for w in all_w: w.configure(bg=hc)
        def _leave(e):
            for w in all_w: w.configure(bg=color)
        for w in all_w:
            w.bind("<Enter>", _enter); w.bind("<Leave>", _leave)
            w.bind("<Button-1>", lambda e: command())
    return card


# ============================================================================
#  واجهة: لوحة المعلومات (Dashboard)
# ============================================================================

class DashboardFrame(tk.Frame):
    def __init__(self, parent, navigate_cb=None):
        super().__init__(parent, bg=COLOR_BG)
        self._navigate_cb = navigate_cb
        self._build()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=20)
        wrap.pack(fill="both", expand=True)

        title = tk.Label(wrap, text=T("dash_title"),
                         font=(FONT_FAMILY, 20, "bold"),
                         bg=COLOR_BG, fg=COLOR_HEADER, anchor=A())
        title.pack(fill="x", pady=(0, 5))
        sub = tk.Label(wrap, text=T("dash_subtitle"),
                       font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT, anchor=A())
        sub.pack(fill="x", pady=(0, 20))

        cands = CandidateDB.get_all()
        instructors = InstructorDB.get_all()
        y = str(date.today().year)
        total_pay = PaymentDB.get_total_by_year(y)
        total_exp = ExpenseDB.get_total_by_year(y)
        profit = total_pay - total_exp

        # دوال التنقل (تعمل فقط إذا مُرّر navigate_cb)
        nav = self._navigate_cb
        go_cands  = (lambda: nav(2)) if nav else None
        go_insts  = (lambda: nav(3)) if nav else None
        go_pay    = (lambda: nav(6)) if nav else None
        go_exp    = (lambda: nav(7)) if nav else None
        go_stages = (lambda: nav(4)) if nav else None

        # صف البطاقات الإحصائية
        stats_row = tk.Frame(wrap, bg=COLOR_BG)
        stats_row.pack(fill="x", pady=(0, 20))
        stat_card(stats_row, T("dash_candidates"), str(len(cands)), "👥", COLOR_PRIMARY,
                  command=go_cands)
        stat_card(stats_row, T("dash_instructors"),  str(len(instructors)), "🚗", COLOR_PURPLE,
                  command=go_insts)
        stat_card(stats_row, T("dash_payments"), f"{total_pay:,.0f}", "💰", COLOR_SUCCESS,
                  command=go_pay)
        stat_card(stats_row, T("dash_expenses"), f"{total_exp:,.0f}", "💸", COLOR_DANGER,
                  command=go_exp)

        # صف الأرباح الكبير
        profit_color = COLOR_SUCCESS if profit >= 0 else COLOR_DANGER
        pf = tk.Frame(wrap, bg=profit_color, padx=24, pady=20)
        pf.pack(fill="x", pady=(0, 20))
        tk.Label(pf, text=f"{T('dash_profit')} {y}",
                 font=(FONT_FAMILY, 14, "bold"),
                 bg=profit_color, fg="white", anchor=A()).pack(side=S())
        tk.Label(pf, text=f"{profit:,.0f} {T('dash_profit_cur')}",
                 font=(FONT_FAMILY, 22, "bold"),
                 bg=profit_color, fg="white", anchor=A()).pack(side=So())

        # إحصائيات النجاح (Success Rates) — مبنية على سجل الامتحانات الفعلي
        exam_stats = {s['stage_type']: s for s in ExamAttemptsDB.get_stats_by_stage()}
        rates_frame = tk.Frame(wrap, bg=COLOR_BG)
        rates_frame.pack(fill="x", pady=(0, 20))

        for stage_code, label in STAGE_LABELS.items():
            es = exam_stats.get(stage_code, {'total': 0, 'passed': 0})
            total  = es.get('total',  0) or 0
            passed = es.get('passed', 0) or 0
            rate   = (passed / total * 100) if total > 0 else 0

            color = COLOR_SUCCESS if rate >= 50 else COLOR_WARNING
            if total == 0: color = COLOR_TEXT_LIGHT

            card_cursor = "hand2" if go_stages else "arrow"
            sc = tk.Frame(rates_frame, bg=COLOR_CARD, padx=15, pady=10,
                          highlightthickness=1, highlightbackground=COLOR_BORDER,
                          cursor=card_cursor)
            sc.pack(side="right", fill="both", expand=True, padx=5)

            lbl_title  = tk.Label(sc, text=label, font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_TEXT)
            lbl_title.pack(anchor=A())
            lbl_rate   = tk.Label(sc, text=f"{rate:.1f}%  {T('dash_pct_pass')}", font=(FONT_FAMILY, 16, "bold"),
                     bg=COLOR_CARD, fg=color)
            lbl_rate.pack(anchor=A())
            lbl_detail = tk.Label(sc,
                     text=f"{T('dash_tries')}: {total}  |  {T('dash_pass')}: {passed}  |  {T('dash_fail')}: {total - passed}",
                     font=FONT_TINY, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT)
            lbl_detail.pack(anchor=A())
            lbl_link   = tk.Label(sc, text=T("dash_view_detail"), font=FONT_TINY,
                     bg=COLOR_CARD, fg=COLOR_PRIMARY, cursor=card_cursor)
            lbl_link.pack(anchor=A())

            if go_stages:
                for w in (sc, lbl_title, lbl_rate, lbl_detail, lbl_link):
                    w.bind("<Button-1>", lambda e, f=go_stages: f())

        # التنبيهات والإشعارات (Notifications & Alerts)
        v_alerts = VehicleDB.get_alerts()
        unpaid = [c for c in cands if (sum(p['amount'] for p in PaymentDB.get_by_candidate(c['id'])) < c['total_amount'])]
        
        if v_alerts or unpaid:
            no_outer, no_body = make_card(wrap, padding=15)
            no_outer.pack(fill="x", pady=(0, 20))
            section_title(no_body, T("dash_alerts"), icon="🔔")
            
            for v in v_alerts:
                msg = f"{T('dash_veh_text')} {v['model']} ({v['plate_number']}): {T('dash_veh_alert')}"
                tk.Label(no_body, text=msg, font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_DANGER, anchor=A()).pack(fill="x")
            
            if unpaid:
                msg = f"{T('dash_there_are')} {len(unpaid)} {T('dash_unpaid')}"
                tk.Label(no_body, text=msg, font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_WARNING, anchor=A()).pack(fill="x")


        # ── حصص اليوم والأسبوع ──
        today_sessions = []
        week_sessions  = []
        try:
            today_sessions = SessionDB.get_today()
            week_sessions  = SessionDB.get_week()
        except Exception:
            pass

        sched_outer, sched_body = make_card(wrap, padding=15)
        sched_outer.pack(fill="x", pady=(0, 16))
        sh = tk.Frame(sched_body, bg=COLOR_CARD)
        sh.pack(fill="x", pady=(0, 8))
        section_title(sched_body, f"{T('dash_today')}  ({len(today_sessions)})", icon="📅")

        if today_sessions:
            sess_tree = create_treeview(sched_body,
                ("time", "candidate", "instructor", "type", "dur"),
                (T("dash_col_time"), T("dash_col_cand"), T("dash_col_inst"), T("dash_col_type"), T("dash_col_dur")),
                (80, 180, 160, 110, 70), height=min(len(today_sessions), 5))
            rows_s = [(s['session_time'], s['candidate_name'],
                       s['instructor_name'], s['session_type'],
                       str(s['duration']))
                      for s in today_sessions]
            insert_zebra(sess_tree, rows_s)
        else:
            tk.Label(sched_body, text=T("dash_no_sess"),
                     font=FONT_MAIN, bg=COLOR_CARD,
                     fg=COLOR_TEXT_LIGHT, anchor=A()).pack(fill="x", pady=6)

        # أول حصة قادمة (غداً+)
        future = [s for s in week_sessions
                  if s['session_date'] > date.today().strftime('%Y-%m-%d')]
        if future:
            nxt = future[0]
            nxt_bar = tk.Frame(sched_body, bg=COLOR_PRIMARY_LIGHT,
                               padx=12, pady=8)
            nxt_bar.pack(fill="x", pady=(8, 0))
            tk.Label(nxt_bar,
                     text=f"{T('dash_next_sess')}  {nxt['session_date']}  {nxt['session_time']}  —  {nxt['candidate_name']}  /  {nxt['instructor_name']}",
                     font=FONT_BOLD, bg=COLOR_PRIMARY_LIGHT,
                     fg=COLOR_PRIMARY, anchor=A()).pack(fill="x")

        # المترشحون الأخيرون
        outer, body = make_card(wrap)
        outer.pack(fill="both", expand=True)
        section_title(body, T("dash_recent"), icon="🆕")

        tree = create_treeview(body,
            ("name", "phone", "license", "instructor", "amount", "date"),
            (T("dash_col_full"), T("dash_col_phone"), T("dash_col_lic"), T("dash_col_inst"),
             T("dash_col_total"), T("dash_col_date")),
            (180, 120, 100, 160, 130, 130), height=6)

        latest = sorted(cands, key=lambda x: x.get('registration_date', ''),
                        reverse=True)[:10]
        rows = [(f"{c['last_name']} {c['first_name']}", c['phone'], c['license_type'],
                 c.get('instructor_name', '—') or '—',
                 f"{c['total_amount']:,.0f} {T('dash_profit_cur')}", c['registration_date'])
                for c in latest]
        insert_zebra(tree, rows)


# ============================================================================
#  واجهة: معلومات المدرسة
# ============================================================================

VEHICLE_TYPES = ["سيارة", "دراجة نارية", "شاحنة", "حافلة", "غيرها"]


class VehicleDialog(tk.Toplevel):
    """نافذة منبثقة لإضافة أو تعديل مركبة."""

    def __init__(self, parent, on_save, vehicle=None):
        super().__init__(parent)
        self.on_save  = on_save
        self.vehicle  = vehicle
        self.vars: dict = {}
        title_text = "تعديل مركبة" if vehicle else "إضافة مركبة جديدة"
        self.title(title_text)
        self.geometry("520x560")
        self.minsize(460, 500)
        self.resizable(True, True)
        self.configure(bg=COLOR_BG)
        self.transient(parent)
        self.grab_set()
        self._build()
        if vehicle:
            self._fill(vehicle)
        else:
            self.vars["vehicle_type"].set("سيارة")

    def _build(self):
        head = tk.Frame(self, bg=COLOR_PRIMARY, pady=14, padx=20)
        head.pack(fill="x")
        title_text = "تعديل بيانات المركبة" if self.vehicle else "إضافة مركبة جديدة"
        tk.Label(head, text=title_text, font=(FONT_FAMILY, 13, "bold"),
                 bg=COLOR_PRIMARY, fg="white", anchor=A()).pack(side=S())

        bf = tk.Frame(self, bg=COLOR_BG, pady=10)
        bf.pack(side="bottom", fill="x", padx=20)
        tk.Frame(bf, bg=COLOR_BORDER, height=1).pack(fill="x", pady=(0, 8))
        ModernButton(bf, "إلغاء", self.destroy, icon="✗",
                     color=COLOR_TEXT_LIGHT).pack(side=So(), padx=5)
        save_lbl = "حفظ التعديلات" if self.vehicle else "إضافة المركبة"
        ModernButton(bf, save_lbl, self._save,
                     color=COLOR_SUCCESS, size="large").pack(side=S(), padx=5)

        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=10)
        wrap.pack(fill="both", expand=True)
        outer, card = make_card(wrap, padding=22)
        outer.pack(fill="both", expand=True)

        grid = tk.Frame(card, bg=COLOR_CARD)
        grid.pack(fill="both", expand=True)
        grid.columnconfigure(0, weight=1)
        grid.columnconfigure(1, weight=1)

        def field(label, key, row, col=0, kind="entry", values=None, colspan=1):
            cell = tk.Frame(grid, bg=COLOR_CARD)
            cell.grid(row=row, column=col, columnspan=colspan,
                      sticky="ew", padx=8, pady=6)
            make_label(cell, label, font=FONT_BOLD).pack(anchor=A())
            v = tk.StringVar()
            self.vars[key] = v
            if kind == "combo":
                w = make_combo(cell, v, values or [], width=24)
            else:
                w = make_entry(cell, v, width=26)
            w.pack(fill="x", ipady=4, pady=(2, 0))

        field("نوع المركبة", "vehicle_type", 0, 0, "combo", VEHICLE_TYPES)
        field("الموديل / الصانع *", "model", 0, 1)
        field("رقم اللوحة", "plate_number", 1, 0)
        field("ملاحظات", "notes", 1, 1)
        field("رقم بطاقة التدريب", "training_card_number", 2, 0)
        field("تاريخ انتهاء التأمين  (YYYY-MM-DD)", "insurance_expiry", 3, 0)
        field("تاريخ انتهاء الفحص التقني  (YYYY-MM-DD)", "tech_inspection_expiry", 3, 1)

    def _fill(self, v: dict):
        for k, var in self.vars.items():
            var.set(v.get(k, ""))
        if not self.vars["vehicle_type"].get():
            self.vars["vehicle_type"].set("سيارة")

    def _save(self):
        model = self.vars["model"].get().strip()
        if not model:
            messagebox.showerror("خطأ", "يجب إدخال موديل/صانع المركبة.")
            return
        data = {k: var.get().strip() for k, var in self.vars.items()}
        if not data.get("vehicle_type"):
            data["vehicle_type"] = "سيارة"
        self.on_save(data)
        self.destroy()


class SchoolInfoFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.vars: dict      = {}
        self._veh_tree       = None
        self._veh_rows: list = []
        self._build()
        self._load()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=30, pady=20)
        wrap.pack(fill="both", expand=True)

        tk.Label(wrap, text=T("school_title"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(fill="x", pady=(0, 5))
        tk.Label(wrap, text=T("school_subtitle"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT,
                 anchor=A()).pack(fill="x", pady=(0, 14))

        nb = ttk.Notebook(wrap, style="Modern.TNotebook")
        nb.pack(fill="both", expand=True)

        tab1 = tk.Frame(nb, bg=COLOR_BG)
        nb.add(tab1, text="  📋  بيانات المدرسة  ")
        self._build_info_tab(tab1)

        tab_owner = tk.Frame(nb, bg=COLOR_BG)
        nb.add(tab_owner, text="  👤  صاحب المدرسة  ")
        self._build_owner_tab(tab_owner)

        tab_rep = tk.Frame(nb, bg=COLOR_BG)
        nb.add(tab_rep, text="  🤝  الممثل  ")
        self._build_rep_tab(tab_rep)

        tab2 = tk.Frame(nb, bg=COLOR_BG)
        nb.add(tab2, text="  🚗  المركبات  ")
        self._build_vehicles_tab(tab2)

    def _build_info_tab(self, parent):
        outer, card = make_card(parent, padding=28)
        outer.pack(fill="both", expand=True, padx=60, pady=20)

        section_title(card, T("school_basic"), icon="📋")

        bf = tk.Frame(card, bg=COLOR_CARD)
        bf.pack(side="bottom", fill="x", pady=(16, 0))
        ModernButton(bf, T("btn_save_info"), self._save,
                     icon="💾", color=COLOR_SUCCESS).pack(side="right", padx=5)
        ModernButton(bf, T("btn_reload"), self._load,
                     icon="🔄", color=COLOR_TEXT_LIGHT).pack(side="right", padx=5)

        _sf = tk.Frame(card, bg=COLOR_CARD)
        _sf.pack(fill="both", expand=True)
        _cv = tk.Canvas(_sf, bg=COLOR_CARD, highlightthickness=0)
        _vsb = ttk.Scrollbar(_sf, orient="vertical", command=_cv.yview)
        _cv.configure(yscrollcommand=_vsb.set)
        _vsb.pack(side="right", fill="y")
        _cv.pack(side="left", fill="both", expand=True)
        grid = tk.Frame(_cv, bg=COLOR_CARD)
        _cw = _cv.create_window((0, 0), window=grid, anchor="nw")
        grid.bind("<Configure>", lambda e: _cv.configure(scrollregion=_cv.bbox("all")))
        _cv.bind("<Configure>", lambda e: _cv.itemconfig(_cw, width=e.width))
        _cv.bind("<MouseWheel>", lambda e: _cv.yview_scroll(int(-1*(e.delta/120)), "units"))
        grid.columnconfigure(0, weight=1)
        grid.columnconfigure(1, weight=1)

        f_name = tk.Frame(grid, bg=COLOR_CARD)
        f_name.grid(row=0, column=0, sticky="ew", padx=10, pady=5)
        make_label(f_name, T("school_name"), font=FONT_BOLD).pack(anchor=A())
        v_name = tk.StringVar()
        self.vars["name"] = v_name
        make_entry(f_name, v_name, width=32).pack(fill="x", ipady=4, pady=(2, 0))

        f_phone = tk.Frame(grid, bg=COLOR_CARD)
        f_phone.grid(row=0, column=1, sticky="ew", padx=10, pady=5)
        make_label(f_phone, T("school_phone"), font=FONT_BOLD).pack(anchor=A())
        v_phone = tk.StringVar()
        self.vars["phone"] = v_phone
        make_entry(f_phone, v_phone, width=32).pack(fill="x", ipady=4, pady=(2, 0))

        f_addr = tk.Frame(grid, bg=COLOR_CARD)
        f_addr.grid(row=1, column=0, sticky="ew", padx=10, pady=5)
        make_label(f_addr, T("school_address"), font=FONT_BOLD).pack(anchor=A())
        v_addr = tk.StringVar()
        self.vars["address"] = v_addr
        make_entry(f_addr, v_addr, width=32).pack(fill="x", ipady=4, pady=(2, 0))

        f_wilaya = tk.Frame(grid, bg=COLOR_CARD)
        f_wilaya.grid(row=1, column=1, sticky="ew", padx=10, pady=5)
        make_label(f_wilaya, T("school_wilaya"), font=FONT_BOLD).pack(anchor=A())
        v_wilaya = tk.StringVar()
        self.vars["wilaya"] = v_wilaya
        ttk.Combobox(f_wilaya, textvariable=v_wilaya,
                     values=ALGERIA_WILAYAS, width=30,
                     state="readonly").pack(fill="x", ipady=4, pady=(2, 0))

        f_commune = tk.Frame(grid, bg=COLOR_CARD)
        f_commune.grid(row=2, column=0, sticky="ew", padx=10, pady=5)
        make_label(f_commune, "البلدية" if LANG == "ar" else "Commune", font=FONT_BOLD).pack(anchor=A())
        v_commune = tk.StringVar(); self.vars["address_commune"] = v_commune
        make_entry(f_commune, v_commune, width=32).pack(fill="x", ipady=4, pady=(2, 0))

        f_daira = tk.Frame(grid, bg=COLOR_CARD)
        f_daira.grid(row=2, column=1, sticky="ew", padx=10, pady=5)
        make_label(f_daira, "الدائرة" if LANG == "ar" else "Daïra", font=FONT_BOLD).pack(anchor=A())
        v_daira = tk.StringVar(); self.vars["address_daira"] = v_daira
        make_entry(f_daira, v_daira, width=32).pack(fill="x", ipady=4, pady=(2, 0))

        other_fields = [
            (T("school_accred"), "accreditation_number"),
            ("تاريخ صدور الاعتماد" if LANG == "ar" else "Date d'agrément", "accreditation_date"),
            ("اسم مسيّر المدرسة" if LANG == "ar" else "Nom du responsable", "manager_name"),
            (T("school_cr"), "commercial_register"),
            ("NIF", "nif"), ("NIS", "nis"),
            ("N° Article", "article_number"),
        ]
        for i, (label, key) in enumerate(other_fields):
            row = (i // 2) + 3
            col = i % 2
            cell = tk.Frame(grid, bg=COLOR_CARD)
            cell.grid(row=row, column=col, sticky="ew", padx=10, pady=5)
            make_label(cell, label, font=FONT_BOLD).pack(anchor=A())
            v = tk.StringVar()
            self.vars[key] = v
            make_entry(cell, v, width=32).pack(fill="x", ipady=4, pady=(2, 0))

    def _build_owner_tab(self, parent):
        outer, card = make_card(parent, padding=28)
        outer.pack(fill="both", expand=True, padx=60, pady=20)
        section_title(card, "معلومات صاحب المدرسة" if LANG == "ar" else "Informations du propriétaire", icon="👤")
        grid = tk.Frame(card, bg=COLOR_CARD)
        grid.pack(fill="x", expand=True)
        grid.columnconfigure(0, weight=1); grid.columnconfigure(1, weight=1)
        owner_fields = [
            ("الاسم واللقب" if LANG == "ar" else "Nom complet",          "owner_name",        0, 0),
            ("تاريخ الميلاد (YYYY-MM-DD)" if LANG == "ar" else "Date de naissance", "owner_birth_date",  0, 1),
            ("مكان الميلاد" if LANG == "ar" else "Lieu de naissance",    "owner_birth_place", 1, 0),
            ("البريد الإلكتروني" if LANG == "ar" else "E-mail",          "owner_email",       1, 1),
        ]
        for lbl, key, r, c in owner_fields:
            cell = tk.Frame(grid, bg=COLOR_CARD)
            cell.grid(row=r, column=c, sticky="ew", padx=10, pady=5)
            make_label(cell, lbl, font=FONT_BOLD).pack(anchor=A())
            v = tk.StringVar(); self.vars[key] = v
            make_entry(cell, v, width=32).pack(fill="x", ipady=4, pady=(2, 0))

    def _build_rep_tab(self, parent):
        outer, card = make_card(parent, padding=28)
        outer.pack(fill="both", expand=True, padx=60, pady=20)
        section_title(card, "معلومات ممثل المدرسة" if LANG == "ar" else "Informations du représentant", icon="🤝")
        grid = tk.Frame(card, bg=COLOR_CARD)
        grid.pack(fill="x", expand=True)
        grid.columnconfigure(0, weight=1); grid.columnconfigure(1, weight=1)
        rep_fields = [
            ("الاسم واللقب" if LANG == "ar" else "Nom complet",          "representative_name",        0, 0),
            ("تاريخ الميلاد (YYYY-MM-DD)" if LANG == "ar" else "Date de naissance", "representative_birth_date",  0, 1),
            ("مكان الميلاد" if LANG == "ar" else "Lieu de naissance",    "representative_birth_place", 1, 0),
        ]
        for lbl, key, r, c in rep_fields:
            cell = tk.Frame(grid, bg=COLOR_CARD)
            cell.grid(row=r, column=c, sticky="ew", padx=10, pady=5)
            make_label(cell, lbl, font=FONT_BOLD).pack(anchor=A())
            v = tk.StringVar(); self.vars[key] = v
            make_entry(cell, v, width=32).pack(fill="x", ipady=4, pady=(2, 0))

    def _build_vehicles_tab(self, parent):
        outer, card = make_card(parent, padding=20)
        outer.pack(fill="both", expand=True, padx=40, pady=20)

        section_title(card, "المركبات المسجّلة", icon="🚗")

        tb = tk.Frame(card, bg=COLOR_CARD)
        tb.pack(fill="x", pady=(0, 10))
        ModernButton(tb, "إضافة مركبة", self._veh_add,
                     icon="➕", color=COLOR_PRIMARY).pack(side=S(), padx=(0, 6))
        ModernButton(tb, "تعديل", self._veh_edit,
                     icon="✏", color=COLOR_WARNING).pack(side=S(), padx=(0, 6))
        ModernButton(tb, "حذف", self._veh_del,
                     icon="🗑", color=COLOR_DANGER).pack(side=S())

        cols   = ("vtype",  "model",          "plate",        "ins_exp",        "tech_exp",              "notes")
        heads  = ("النوع", "الموديل / الصانع", "رقم اللوحة", "انتهاء التأمين", "انتهاء الفحص التقني",  "الملاحظات")
        widths = (90,       160,               110,            115,              140,                     130)
        self._veh_tree = create_treeview(card, cols, heads, widths, height=10)
        self._veh_tree.bind("<Double-1>", lambda e: self._veh_edit())
        self._veh_refresh()

    def _veh_refresh(self):
        if self._veh_tree is None:
            return
        rows = VehicleDB.get_all()
        self._veh_rows = rows
        insert_zebra(self._veh_tree, [
            (r.get("vehicle_type", "سيارة"),
             r.get("model", ""),
             r.get("plate_number", ""),
             r.get("insurance_expiry", ""),
             r.get("tech_inspection_expiry", ""),
             r.get("notes", ""))
            for r in rows
        ])

    def _veh_selected(self):
        sel = self._veh_tree.selection()
        if not sel:
            messagebox.showwarning("تنبيه", "يرجى تحديد مركبة أولاً.")
            return None
        idx = self._veh_tree.index(sel[0])
        return self._veh_rows[idx] if idx < len(self._veh_rows) else None

    def _veh_add(self):
        VehicleDialog(self, self._on_veh_save)

    def _veh_edit(self):
        v = self._veh_selected()
        if v:
            vid = v["id"]
            VehicleDialog(self,
                          lambda data, _id=vid: self._on_veh_save(data, _id),
                          vehicle=v)

    def _veh_del(self):
        v = self._veh_selected()
        if v and messagebox.askyesno(
                "تأكيد الحذف",
                f"هل تريد حذف المركبة: {v.get('model', '')}؟"):
            VehicleDB.delete(v["id"])
            self._veh_refresh()

    def _on_veh_save(self, data: dict, vid: int = None):
        if vid:
            VehicleDB.update(vid, data)
        else:
            VehicleDB.add(data)
        self._veh_refresh()

    def _load(self):
        d = SchoolInfoDB.get()
        for k, v in self.vars.items():
            v.set(d.get(k, ""))

    def _save(self):
        if not self.vars["name"].get().strip():
            show_error(T("school_err_name"))
            return
        SchoolInfoDB.update({k: v.get().strip() for k, v in self.vars.items()})
        show_info(T("school_saved"))


# ============================================================================
#  نافذة منبثقة لإضافة/تعديل المترشحين (الحل لمشكلة الحقول)
# ============================================================================

class CandidateDialog(tk.Toplevel):
    def __init__(self, parent, on_save, candidate=None):
        super().__init__(parent)
        self.on_save = on_save
        self.candidate = candidate
        self.vars = {}
        self.born_abroad_var = tk.IntVar(value=0)
        self.title(T("cand_edit_title") if candidate else T("cand_add_title"))
        self.geometry("980x680")
        self.minsize(880, 580)
        self.resizable(True, True)
        self.configure(bg=COLOR_BG)
        self.transient(parent)
        self.grab_set()
        self._build()
        if candidate:
            self._fill(candidate)
        self._toggle_abroad_fields()

    def _instructor_options(self):
        instructors = InstructorDB.get_all()
        self.instructor_map = {f"{i['last_name']} {i['first_name']}": i['id']
                                for i in instructors}
        self.instructor_map[""] = None
        return [""] + list(self.instructor_map.keys())[:-1]

    def _make_field(self, parent, label, key, kind="entry", values=None,
                    width=28, row=0, col=0, colspan=1, combo_state="readonly"):
        cell = tk.Frame(parent, bg=COLOR_CARD)
        cell.grid(row=row, column=col, columnspan=colspan,
                  sticky="ew", padx=10, pady=5)
        make_label(cell, label, font=FONT_BOLD).pack(anchor=A())
        v = tk.StringVar()
        self.vars[key] = v
        if kind == "combo":
            w = make_combo(cell, v, values or [], width=width, state=combo_state)
        else:
            w = make_entry(cell, v, width=width + 2)
        w.pack(fill="x", ipady=4, pady=(2, 0))
        return v, w, cell

    def _build(self):
        # ===== رأس النافذة =====
        head = tk.Frame(self, bg=COLOR_PRIMARY, pady=16, padx=20)
        head.pack(fill="x", side="top")
        title_text = T("cdlg_title_edit") if self.candidate else T("cdlg_title_add")
        tk.Label(head, text=title_text, font=(FONT_FAMILY, 15, "bold"),
                 bg=COLOR_PRIMARY, fg="white", anchor=A()).pack(side=S())
        tk.Label(head, text=T("cdlg_subtitle"),
                 font=(FONT_FAMILY, 10), bg=COLOR_PRIMARY, fg="#c7d2fe",
                 anchor=A()).pack(side=So())

        # ===== شريط الأزرار (يُعبَّأ أولاً ليبقى ظاهراً دائماً) =====
        bf = tk.Frame(self, bg=COLOR_BG, pady=10)
        bf.pack(side="bottom", fill="x", padx=20)
        tk.Frame(bf, bg=COLOR_BORDER, height=1).pack(fill="x", pady=(0, 10))
        ModernButton(bf, T("cdlg_btn_cancel"), self.destroy, icon="✗",
                     color=COLOR_TEXT_LIGHT).pack(side=So(), padx=5)
        save_lbl = T("cdlg_btn_save_edit") if self.candidate else T("cdlg_btn_save_add")
        ModernButton(bf, save_lbl, self._save,
                     color=COLOR_SUCCESS, size="large").pack(side=S(), padx=5)

        # ===== المحتوى (يملأ الفراغ المتبقي) =====
        wrap = tk.Frame(self, bg=COLOR_BG, padx=12, pady=8)
        wrap.pack(fill="both", expand=True)

        nb = ttk.Notebook(wrap, style="Modern.TNotebook")
        nb.pack(fill="both", expand=True)

        # ══════════════════════════════════════════════
        # التبويب 1: بيانات الملف والمعلومات الشخصية
        # ══════════════════════════════════════════════
        tab1 = tk.Frame(nb, bg=COLOR_CARD, padx=18, pady=12)
        nb.add(tab1, text=T("cdlg_tab_personal"))

        # -- قسم: بيانات الملف (رقم الملف + تاريخ الإيداع) --
        section_title(tab1, T("cdlg_sec_file"), icon="📁")
        gf = tk.Frame(tab1, bg=COLOR_CARD)
        gf.pack(fill="x")
        gf.columnconfigure(0, weight=1); gf.columnconfigure(1, weight=1)
        self._make_field(gf, T("cdlg_f_file_num"),  "file_number", row=0, col=0)
        self._make_field(gf, T("cdlg_f_file_date"), "file_date",   row=0, col=1)

        # -- قسم: المعلومات الشخصية (scrollable) --
        section_title(tab1, T("cdlg_sec_personal"), icon="📝")
        _sc_outer = tk.Frame(tab1, bg=COLOR_CARD)
        _sc_outer.pack(fill="both", expand=True)
        _sc_canvas = tk.Canvas(_sc_outer, bg=COLOR_CARD, highlightthickness=0)
        _sc_bar = ttk.Scrollbar(_sc_outer, orient="vertical", command=_sc_canvas.yview)
        _sc_canvas.configure(yscrollcommand=_sc_bar.set)
        _sc_bar.pack(side="right", fill="y")
        _sc_canvas.pack(side="left", fill="both", expand=True)
        g1 = tk.Frame(_sc_canvas, bg=COLOR_CARD)
        g1.columnconfigure(0, weight=1); g1.columnconfigure(1, weight=1)
        _sc_win = _sc_canvas.create_window((0, 0), window=g1, anchor="nw")
        def _on_g1_cfg(e): _sc_canvas.configure(scrollregion=_sc_canvas.bbox("all"))
        def _on_cv_cfg(e):  _sc_canvas.itemconfig(_sc_win, width=e.width)
        def _on_mw(e):      _sc_canvas.yview_scroll(int(-1*(e.delta/120)), "units")
        g1.bind("<Configure>", _on_g1_cfg)
        _sc_canvas.bind("<Configure>", _on_cv_cfg)
        _sc_canvas.bind("<Enter>", lambda e: _sc_canvas.bind_all("<MouseWheel>", _on_mw))
        _sc_canvas.bind("<Leave>", lambda e: _sc_canvas.unbind_all("<MouseWheel>"))

        personal = [
            (T("cdlg_f_lastname"),     "last_name",     "entry", None),
            (T("cdlg_f_firstname"),    "first_name",    "entry", None),
            (T("cdlg_f_lastname_fr"),  "last_name_fr",  "entry", None),
            (T("cdlg_f_firstname_fr"), "first_name_fr", "entry", None),
            (T("cdlg_f_gender"),    "gender",             "combo", gender_opts()),
            (T("cdlg_f_marital"),   "marital_status",     "combo", marital_opts()),
            (T("cdlg_f_nin"),       "national_id",        "entry", None),
            (T("cdlg_f_blood"),     "blood_type",         "combo", BLOOD_TYPE_OPTIONS),
            (T("cdlg_f_father"),    "father_name",        "entry", None),
            (T("cdlg_f_mother"),    "mother_name",        "entry", None),
            (T("cdlg_f_phone"),     "phone",              "entry", None),
            ("البريد الإلكتروني" if LANG == "ar" else "E-mail", "email", "entry", None),
            ("رقم التأمين" if LANG == "ar" else "N° Assurance", "insurance_number", "entry", None),
            (T("cdlg_f_nat"),       "nationality",        "entry", None),
            (T("cdlg_f_nat2"),      "second_nationality", "entry", None),
            (T("cdlg_f_disab"),     "disability",         "entry", None),
        ]
        for i, (lbl, key, kind, vals) in enumerate(personal):
            self._make_field(g1, lbl, key, kind, vals, row=i // 2, col=i % 2)

        # ══════════════════════════════════════════════
        # التبويب 2: الميلاد والعنوان
        # ══════════════════════════════════════════════
        tab2 = tk.Frame(nb, bg=COLOR_CARD)
        nb.add(tab2, text=T("cdlg_tab_birth"))

        _t2_canvas = tk.Canvas(tab2, bg=COLOR_CARD, highlightthickness=0)
        _t2_bar = ttk.Scrollbar(tab2, orient="vertical", command=_t2_canvas.yview)
        _t2_canvas.configure(yscrollcommand=_t2_bar.set)
        _t2_bar.pack(side="right", fill="y")
        _t2_canvas.pack(side="left", fill="both", expand=True)
        _tab2_inner = tk.Frame(_t2_canvas, bg=COLOR_CARD, padx=18, pady=12)
        _t2_win = _t2_canvas.create_window((0, 0), window=_tab2_inner, anchor="nw")
        def _on_t2_cfg(e): _t2_canvas.configure(scrollregion=_t2_canvas.bbox("all"))
        def _on_t2_cv(e):  _t2_canvas.itemconfig(_t2_win, width=e.width)
        def _on_t2_mw(e):  _t2_canvas.yview_scroll(int(-1*(e.delta/120)), "units")
        _tab2_inner.bind("<Configure>", _on_t2_cfg)
        _t2_canvas.bind("<Configure>", _on_t2_cv)
        _t2_canvas.bind("<Enter>", lambda e: _t2_canvas.bind_all("<MouseWheel>", _on_t2_mw))
        _t2_canvas.bind("<Leave>", lambda e: _t2_canvas.unbind_all("<MouseWheel>"))

        section_title(_tab2_inner, T("cdlg_sec_birth"), icon="🎂")

        # خيار: مولود بالخارج
        ab_box = tk.Frame(_tab2_inner, bg=COLOR_PRIMARY_LIGHT, padx=12, pady=8)
        ab_box.pack(fill="x", pady=(0, 8))
        tk.Checkbutton(ab_box,
                       text=T("cdlg_born_abroad"),
                       variable=self.born_abroad_var,
                       command=self._toggle_abroad_fields,
                       font=FONT_BOLD, bg=COLOR_PRIMARY_LIGHT,
                       fg=COLOR_PRIMARY_DARK, activebackground=COLOR_PRIMARY_LIGHT,
                       selectcolor=COLOR_WHITE, anchor=A()).pack(anchor=A())

        g2 = tk.Frame(_tab2_inner, bg=COLOR_CARD)
        g2.pack(fill="x")
        g2.columnconfigure(0, weight=1); g2.columnconfigure(1, weight=1)

        self._make_field(g2, T("cdlg_f_bdate"),
                         "birth_date", "entry", row=0, col=0)
        self._make_field(g2, T("cdlg_f_bcountry"),
                         "birth_country", "entry", row=0, col=1)
        _, self._birth_commune_w, _ = self._make_field(
            g2, T("cdlg_f_bcommune"),
            "birth_place_commune", "combo", [], row=1, col=0, combo_state="normal")
        _, _birth_wilaya_w, _ = self._make_field(
            g2, T("cdlg_f_bwilaya"),
            "birth_place_wilaya", "combo", ALGERIA_WILAYAS, row=1, col=1, combo_state="normal")
        self.vars["birth_place_wilaya"].trace_add(
            "write", lambda *_: self._on_wilaya_change("birth_place_wilaya",
                                                       "birth_place_commune",
                                                       self._birth_commune_w))

        _, _w_emb, c_emb = self._make_field(
            g2, T("cdlg_f_embassy"),  "embassy",  "entry", row=2, col=0)
        _, _w_con, c_con = self._make_field(
            g2, T("cdlg_f_consulate"),"consulate","entry", row=2, col=1)
        self._abroad_widgets = [c_emb, c_con]

        # -- العنوان الحالي --
        section_title(_tab2_inner, T("cdlg_sec_addr"), icon="🏠")
        g_addr = tk.Frame(_tab2_inner, bg=COLOR_CARD)
        g_addr.pack(fill="x")
        g_addr.columnconfigure(0, weight=1); g_addr.columnconfigure(1, weight=1)
        _, self._addr_commune_w, _ = self._make_field(
            g_addr, T("cdlg_f_acommune"),
            "address_commune", "combo", [], row=0, col=0, combo_state="normal")
        self._make_field(g_addr, T("cdlg_f_awilaya"),
                         "address_wilaya", "combo", ALGERIA_WILAYAS, row=0, col=1, combo_state="normal")
        self.vars["address_wilaya"].trace_add(
            "write", lambda *_: self._on_wilaya_change("address_wilaya",
                                                       "address_commune",
                                                       self._addr_commune_w))

        addr_cell = tk.Frame(_tab2_inner, bg=COLOR_CARD)
        addr_cell.pack(fill="x", padx=10, pady=4)
        make_label(addr_cell, T("cdlg_f_addr"), font=FONT_BOLD).pack(anchor=A())
        v_addr = tk.StringVar(); self.vars["current_address"] = v_addr
        make_entry(addr_cell, v_addr, width=80).pack(fill="x", ipady=5, pady=(2, 0))

        # ══════════════════════════════════════════════
        # التبويب 3: التسجيل والتكوين والأصناف السابقة
        # ══════════════════════════════════════════════
        tab3 = tk.Frame(nb, bg=COLOR_CARD, padx=18, pady=12)
        nb.add(tab3, text=T("cdlg_tab_reg"))

        # -- نوع الرخصة --
        section_title(tab3, T("cdlg_sec_license"), icon="🎯")
        lic_card = tk.Frame(tab3, bg=COLOR_PRIMARY_LIGHT, padx=14, pady=10)
        lic_card.pack(fill="x", pady=(0, 10))
        tk.Label(lic_card, text=T("cdlg_f_lic_type"),
                 font=(FONT_FAMILY, 12, "bold"),
                 bg=COLOR_PRIMARY_LIGHT, fg=COLOR_PRIMARY_DARK, anchor=A()).pack(anchor=A())
        v_lic = tk.StringVar(); self.vars["license_type"] = v_lic
        make_combo(lic_card, v_lic, LICENSE_OPTIONS, width=20).pack(
            anchor=A(), pady=(4, 2), ipady=4)
        tk.Label(lic_card, text=T("cdlg_f_lic_hint"),
                 font=FONT_SMALL, bg=COLOR_PRIMARY_LIGHT, fg=COLOR_PRIMARY_DARK, anchor=A()).pack(anchor=A())

        # -- الممرن والمبالغ --
        section_title(tab3, T("cdlg_sec_inst_pay"), icon="💰")
        opts = self._instructor_options()
        g3 = tk.Frame(tab3, bg=COLOR_CARD)
        g3.pack(fill="x")
        g3.columnconfigure(0, weight=1); g3.columnconfigure(1, weight=1)

        self._make_field(g3, T("cdlg_f_inst"),
                         "instructor_name", "combo", opts, row=0, col=0)
        self._make_field(g3, T("cdlg_f_total_amt"),
                         "total_amount", "entry", row=0, col=1)
        if not self.candidate:
            self._make_field(g3, T("cdlg_f_init_pay"),
                             "initial_payment", "entry", row=1, col=0)

        # -- الأصناف المتحصل عليها من قبل --
        section_title(tab3, T("cdlg_sec_prev_lic"), icon="📋")
        self.vars["previous_licenses"] = tk.StringVar()
        self._prev_lic_data = []  # list of (cat, num, date, org)

        prev_frame = tk.Frame(tab3, bg=COLOR_CARD, padx=10, pady=6)
        prev_frame.pack(fill="x", padx=10, pady=4)

        self._prev_lic_lbl = tk.Label(
            prev_frame,
            text=_pdf_t("لا توجد أصناف مضافة", "Aucune catégorie ajoutée"),
            font=FONT_MAIN, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT, anchor=A())
        self._prev_lic_lbl.pack(fill="x", pady=(0, 6))

        ModernButton(prev_frame,
                     _pdf_t("إدارة الأصناف السابقة", "Gérer les catégories"),
                     self._open_prev_lic_window,
                     icon="📋", color=COLOR_PRIMARY).pack(anchor=A())

        # ══════════════════════════════════════════════
        # التبويب 4: الممثل الشرعي (للقاصرين)
        # ══════════════════════════════════════════════
        tab_guard = tk.Frame(nb, bg=COLOR_CARD, padx=18, pady=12)
        nb.add(tab_guard, text="  👨‍👦  الممثل الشرعي  ")

        section_title(tab_guard, "معلومات الممثل الشرعي (للمترشح القاصر)" if LANG == "ar"
                      else "Représentant légal (mineur)", icon="👨‍👦")

        info_lbl = tk.Label(tab_guard,
            text="يُملأ هذا القسم فقط إذا كان المترشح قاصراً (أقل من 18 سنة)" if LANG == "ar"
                 else "À remplir uniquement si le candidat est mineur",
            font=FONT_MAIN, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT, anchor=A())
        info_lbl.pack(fill="x", padx=10, pady=(0, 8))

        g_guard = tk.Frame(tab_guard, bg=COLOR_CARD)
        g_guard.pack(fill="x")
        g_guard.columnconfigure(0, weight=1); g_guard.columnconfigure(1, weight=1)

        guard_fields = [
            ("اللقب" if LANG == "ar" else "Nom",                           "guardian_last_name",  0, 0),
            ("الاسم" if LANG == "ar" else "Prénom",                        "guardian_first_name", 0, 1),
            ("تاريخ الميلاد (YYYY-MM-DD)" if LANG == "ar" else "Date naissance", "guardian_birth_date", 1, 0),
            ("رقم الهاتف" if LANG == "ar" else "Téléphone",               "guardian_phone",      1, 1),
        ]
        for lbl, key, r, c in guard_fields:
            self._make_field(g_guard, lbl, key, row=r, col=c)

        addr_guard = tk.Frame(tab_guard, bg=COLOR_CARD)
        addr_guard.pack(fill="x", padx=10, pady=4)
        make_label(addr_guard, "العنوان" if LANG == "ar" else "Adresse", font=FONT_BOLD).pack(anchor=A())
        v_gaddr = tk.StringVar(); self.vars["guardian_address"] = v_gaddr
        make_entry(addr_guard, v_gaddr, width=80).pack(fill="x", ipady=5, pady=(2, 0))

        # ══════════════════════════════════════════════
        # التبويب 5: نتائج الامتحانات (تعديل فقط)
        # ══════════════════════════════════════════════
        tab4 = tk.Frame(nb, bg=COLOR_CARD, padx=18, pady=12)
        nb.add(tab4, text=T("cdlg_tab_exams"))

        if self.candidate:
            # -- ملخص الإحصائيات --
            self._exam_stats_frame = tk.Frame(tab4, bg=COLOR_BG)
            self._exam_stats_frame.pack(fill="x", pady=(0, 10))

            # -- جدول النتائج --
            section_title(tab4, T("cdlg_sec_exam_hist"), icon="📋")
            tree_outer, tree_card = make_card(tab4, padding=8)
            tree_outer.pack(fill="both", expand=True, pady=(0, 8))
            self._exam_tree = create_treeview(
                tree_card,
                ("id", "exam_type", "exam_date", "result", "score", "notes"),
                (T("cand_col_num"), T("exdlg_f_type"), T("exdlg_f_date"), T("exdlg_f_result"), T("exdlg_f_score"), T("cand_col_notes")),
                (0, 120, 120, 90, 80, 220),
                height=8
            )
            self._exam_tree.column("id", width=0, stretch=False)

            # -- أزرار الإضافة والحذف --
            btn_bar = tk.Frame(tab4, bg=COLOR_CARD)
            btn_bar.pack(fill="x")
            ModernButton(btn_bar, T("cdlg_btn_add_res"), self._add_exam_result,
                         icon="➕", color=COLOR_SUCCESS).pack(side=S(), padx=4)
            ModernButton(btn_bar, T("cdlg_btn_del_res"), self._delete_exam_result,
                         icon="🗑️", color=COLOR_DANGER).pack(side=S(), padx=4)

            self._load_exam_results()
        else:
            tk.Label(tab4,
                     text=T("cdlg_save_first"),
                     font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT,
                     wraplength=500, justify=J(), anchor="center").pack(
                         expand=True, anchor="center")

        # ══════════════════════════════════════════════
        # القيم الافتراضية
        # ══════════════════════════════════════════════
        self.vars["nationality"].set(T("cdlg_default_nationality"))
        self.vars["birth_country"].set(T("cdlg_default_birth_country"))
        self.vars["license_type"].set("B")

    def _on_wilaya_change(self, wilaya_key: str, commune_key: str, commune_widget):
        wilaya_val = self.vars[wilaya_key].get()
        communes = ALGERIA_COMMUNES.get(wilaya_val, [])
        commune_widget["values"] = communes
        current = self.vars[commune_key].get()
        if current not in communes and current == "":
            self.vars[commune_key].set("")

    def _toggle_abroad_fields(self):
        enabled = self.born_abroad_var.get() == 1
        for cell in getattr(self, "_abroad_widgets", []):
            for child in cell.winfo_children():
                try:
                    if isinstance(child, tk.Entry):
                        child.config(state="normal" if enabled else "disabled",
                                     bg=COLOR_INPUT_BG if enabled else "#e2e8f0")
                except Exception:
                    pass

    def _fill(self, c):
        for k, v in self.vars.items():
            if k == "previous_licenses":
                continue  # filled separately via Treeview
            elif k == "instructor_name":
                inst = InstructorDB.get(c.get("instructor_id")) if c.get("instructor_id") else None
                v.set(f"{inst['last_name']} {inst['first_name']}" if inst else "")
            elif k == "gender":
                v.set(to_disp_gender(str(c.get(k, "") or "")))
            elif k == "marital_status":
                v.set(to_disp_marital(str(c.get(k, "") or "")))
            else:
                v.set(str(c.get(k, "")) if c.get(k) is not None else "")
        self.born_abroad_var.set(int(c.get("is_born_abroad") or 0))
        # Fill previous licenses data list
        self._prev_lic_data.clear()
        raw = c.get("previous_licenses", "") or ""
        for entry in raw.split(","):
            entry = entry.strip()
            if not entry:
                continue
            parts = entry.split("|")
            cat  = parts[0].strip() if len(parts) > 0 else ""
            num  = parts[1].strip() if len(parts) > 1 else ""
            date = parts[2].strip() if len(parts) > 2 else ""
            org  = parts[3].strip() if len(parts) > 3 else ""
            if cat:
                self._prev_lic_data.append((cat, num, date, org))
        count = len(self._prev_lic_data)
        if count:
            cats = ", ".join(r[0] for r in self._prev_lic_data)
            self._prev_lic_lbl.configure(
                text=_pdf_t(f"{count} صنف: {cats}", f"{count} catégorie(s): {cats}"),
                fg=COLOR_TEXT)
        else:
            self._prev_lic_lbl.configure(
                text=_pdf_t("لا توجد أصناف مضافة", "Aucune catégorie ajoutée"),
                fg=COLOR_TEXT_LIGHT)

    # ── نافذة إدارة الأصناف السابقة ──────────────────────────────────────────
    def _open_prev_lic_window(self):
        win = tk.Toplevel(self)
        win.title(_pdf_t("الأصناف المتحصل عليها من قبل", "Catégories précédentes"))
        win.geometry("700x400")
        win.minsize(600, 340)
        win.configure(bg=COLOR_BG)
        win.transient(self)
        win.grab_set()

        PREV_CATS = ["A1","A","B","D","C1","C","BE","C1E","CE","DE","F"]
        cols   = ("cat","num","date","org")
        hdrs   = (_pdf_t("الصنف","Cat."), _pdf_t("الرقم","N°"),
                  _pdf_t("التاريخ","Date"), _pdf_t("هيئة الإصدار","Organisme"))
        widths = (70, 140, 110, 220)

        # رأس النافذة
        head = tk.Frame(win, bg=COLOR_PRIMARY, pady=10, padx=16)
        head.pack(fill="x")
        tk.Label(head, text=_pdf_t("الأصناف المتحصل عليها من قبل",
                                   "Catégories précédentes"),
                 font=(FONT_FAMILY, 13, "bold"),
                 bg=COLOR_PRIMARY, fg="white", anchor=A()).pack(side=S())

        body = tk.Frame(win, bg=COLOR_BG, padx=14, pady=10)
        body.pack(fill="both", expand=True)

        # صف الإدخال الأول: الصنف + رقم الرخصة + تاريخ الإصدار
        inp_row = tk.Frame(body, bg=COLOR_BG)
        inp_row.pack(fill="x", pady=(0, 4))
        tk.Label(inp_row, text=_pdf_t("الصنف","Cat."),
                 font=FONT_BOLD, bg=COLOR_BG).pack(side=S(), padx=(0,4))
        v_pcat = tk.StringVar(value="B")
        make_combo(inp_row, v_pcat, PREV_CATS, width=6).pack(side=S(), padx=(0,10))
        tk.Label(inp_row, text=_pdf_t("رقم الرخصة","N° Permis"),
                 font=FONT_BOLD, bg=COLOR_BG).pack(side=S(), padx=(0,4))
        v_pnum = tk.StringVar()
        make_entry(inp_row, v_pnum, width=14).pack(side=S(), padx=(0,10))
        tk.Label(inp_row, text=_pdf_t("تاريخ الإصدار","Date"),
                 font=FONT_BOLD, bg=COLOR_BG).pack(side=S(), padx=(0,4))
        v_pdate = tk.StringVar()
        make_entry(inp_row, v_pdate, width=12).pack(side=S(), padx=(0,10))

        # صف الإدخال الثاني: هيئة الإصدار
        inp_row2 = tk.Frame(body, bg=COLOR_BG)
        inp_row2.pack(fill="x", pady=(0, 6))
        tk.Label(inp_row2, text=_pdf_t("هيئة الإصدار","Organisme"),
                 font=FONT_BOLD, bg=COLOR_BG).pack(side=S(), padx=(0,4))
        v_porg = tk.StringVar()
        make_entry(inp_row2, v_porg, width=40).pack(side=S(), padx=(0,10))

        # الجدول
        tree_f = tk.Frame(body, bg=COLOR_BG)
        tree_f.pack(fill="both", expand=True, pady=(4, 8))
        tree = ttk.Treeview(tree_f, columns=cols, show="headings", height=8)
        for col_id, h, w in zip(cols, hdrs, widths):
            tree.heading(col_id, text=h)
            tree.column(col_id, width=w, anchor="center")
        _sb = ttk.Scrollbar(tree_f, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=_sb.set)
        tree.pack(side="left", fill="both", expand=True)
        _sb.pack(side="right", fill="y")

        # تعبئة البيانات الموجودة
        for (cat, num, date, org) in self._prev_lic_data:
            tree.insert("", "end", values=(cat, num, date, org))

        def _add():
            cat = v_pcat.get().strip()
            if not cat:
                return
            for item in tree.get_children():
                if str(tree.item(item)["values"][0]) == cat:
                    tree.delete(item)
            tree.insert("", "end", values=(
                cat, v_pnum.get().strip(),
                v_pdate.get().strip(), v_porg.get().strip()))
            v_pnum.set(""); v_pdate.set(""); v_porg.set("")

        def _del():
            for item in tree.selection():
                tree.delete(item)

        def _confirm():
            self._prev_lic_data.clear()
            for item in tree.get_children():
                vals = tree.item(item)["values"]
                self._prev_lic_data.append((
                    str(vals[0]) if len(vals) > 0 else "",
                    str(vals[1]) if len(vals) > 1 else "",
                    str(vals[2]) if len(vals) > 2 else "",
                    str(vals[3]) if len(vals) > 3 else "",
                ))
            count = len(self._prev_lic_data)
            if count:
                cats = ", ".join(r[0] for r in self._prev_lic_data)
                self._prev_lic_lbl.configure(
                    text=_pdf_t(f"{count} صنف: {cats}",
                                f"{count} catégorie(s): {cats}"),
                    fg=COLOR_TEXT)
            else:
                self._prev_lic_lbl.configure(
                    text=_pdf_t("لا توجد أصناف مضافة", "Aucune catégorie ajoutée"),
                    fg=COLOR_TEXT_LIGHT)
            win.destroy()

        win.protocol("WM_DELETE_WINDOW", _confirm)

        # أزرار
        btn_row = tk.Frame(body, bg=COLOR_BG)
        btn_row.pack(fill="x")
        ModernButton(btn_row, _pdf_t("إضافة","Ajouter"),
                     _add, icon="➕", color=COLOR_SUCCESS).pack(side=S(), padx=4)
        ModernButton(btn_row, _pdf_t("حذف المحدد","Supprimer"),
                     _del, icon="🗑️", color=COLOR_DANGER).pack(side=S(), padx=4)
        ModernButton(btn_row, _pdf_t("✔ تأكيد وإغلاق","✔ Confirmer"),
                     _confirm, color=COLOR_PRIMARY).pack(side=So(), padx=4)

    # ── نتائج الامتحانات ──────────────────────────────────────────────────────
    def _load_exam_results(self):
        if not self.candidate:
            return
        cid = self.candidate['id']
        rows = ExamResultDB.get_by_candidate(cid)

        # --- ملخص الإحصائيات ---
        for w in self._exam_stats_frame.winfo_children():
            w.destroy()

        stats = {}
        for r in rows:
            t = r['exam_type']
            stats.setdefault(t, {"total": 0, "passed": 0})
            stats[t]["total"]  += 1
            if r["result"] == "ناجح":
                stats[t]["passed"] += 1

        for etype_ar, etype_disp in zip(_ETYPE_AR, exam_type_opts()):
            s = stats.get(etype_ar, {"total": 0, "passed": 0})
            total  = s["total"]
            passed = s["passed"]
            failed = total - passed
            pct    = int(passed / total * 100) if total else 0
            color  = COLOR_SUCCESS if pct >= 50 else (COLOR_WARNING if total == 0 else COLOR_DANGER)
            card   = tk.Frame(self._exam_stats_frame, bg=color,
                              padx=14, pady=10, relief="flat")
            card.pack(side=S(), padx=6)
            tk.Label(card, text=f"{T('cdlg_exam_card')} {etype_disp}",
                     font=FONT_BOLD, bg=color, fg="white").pack()
            tk.Label(card, text=f"{passed}/{total}  ({pct}%  {T('cdlg_exam_pct')})",
                     font=(FONT_FAMILY, 10), bg=color, fg="white").pack()
            tk.Label(card, text=f"✅ {passed}  ❌ {failed}  |  {T('cdlg_exam_tries')}: {total}",
                     font=FONT_TINY, bg=color, fg="white").pack()

        # --- ملء الجدول (القيم المعروضة مترجمة حسب اللغة) ---
        values = [
            (r['id'],
             to_disp_exam_type(r['exam_type']),
             r['exam_date'],
             to_disp_exam_result(r['result']),
             f"{r['score']:g}" if r['score'] else "—",
             r['notes'] or "")
            for r in rows
        ]
        insert_zebra(self._exam_tree, values)

        # لون النتيجة — نقارن بالقيمة الأصلية من قاعدة البيانات (عربي دائماً)
        for item, r in zip(self._exam_tree.get_children(), rows):
            if r["result"] == "ناجح":
                self._exam_tree.item(item, tags=("pass",))
            else:
                self._exam_tree.item(item, tags=("fail",))
        self._exam_tree.tag_configure("pass", foreground=COLOR_SUCCESS)
        self._exam_tree.tag_configure("fail", foreground=COLOR_DANGER)

    def _add_exam_result(self):
        if not self.candidate:
            return
        def on_save(data):
            ExamResultDB.add(data)
            self._load_exam_results()
            show_info(T("cand_exam_added"))
        ExamResultDialog(self, self.candidate['id'], on_save=on_save)

    def _delete_exam_result(self):
        if not self.candidate:
            return
        sel = self._exam_tree.selection()
        if not sel:
            show_error(T("cand_exam_sel_first")); return
        rid = self._exam_tree.item(sel[0])['values'][0]
        if confirm_delete(T("cand_exam_del_confirm")):
            ExamResultDB.delete(rid)
            self._load_exam_results()
            show_info(T("cand_exam_deleted"))

    def _save(self):
        try:
            total = float(self.vars["total_amount"].get().replace(",", ".").replace(" ", "") or 0)
        except ValueError:
            total = 0

        initial = 0
        if "initial_payment" in self.vars:
            try:
                initial = float(self.vars["initial_payment"].get().replace(",", ".").replace(" ", "") or 0)
            except ValueError:
                initial = 0

        instr = self.instructor_map.get(self.vars["instructor_name"].get())

        text_keys = ["first_name", "last_name", "last_name_fr", "first_name_fr",
                     "birth_date", "birth_place_commune",
                     "birth_place_wilaya", "father_name", "mother_name", "phone",
                     "disability", "national_id",
                     "second_nationality", "current_address", "embassy", "consulate",
                     "file_number", "file_date", "address_commune", "address_wilaya",
                     "insurance_number", "email",
                     "guardian_first_name", "guardian_last_name", "guardian_birth_date",
                     "guardian_address", "guardian_phone"]
        try:
            d = {k: self.vars[k].get().strip() for k in text_keys}
        except KeyError as _ke:
            show_error(f"خطأ في قراءة الحقل: {_ke}"); return
        # Collect previous licenses from data list
        try:
            prev_entries = []
            for (cat, num, date, org) in self._prev_lic_data:
                if cat:
                    prev_entries.append(f"{cat}|{num}|{date}|{org}")
            d["previous_licenses"] = ", ".join(prev_entries)
        except Exception as _pe:
            d["previous_licenses"] = ""
        d["blood_type"]     = self.vars["blood_type"].get()
        d["license_type"]   = self.vars["license_type"].get()
        d["gender"]         = to_ar_gender(self.vars["gender"].get())
        d["marital_status"] = to_ar_marital(self.vars["marital_status"].get())
        d["nationality"]    = self.vars["nationality"].get().strip() or "جزائرية"
        d["birth_country"]  = self.vars["birth_country"].get().strip()
        d["instructor_id"]  = instr
        d["total_amount"]   = total
        d["is_born_abroad"] = self.born_abroad_var.get()
        if not self.candidate:
            d["initial_payment"] = initial

        if not d["first_name"] or not d["last_name"]:
            show_error(T("cand_err_name")); return
        if not d["license_type"]:
            show_error(T("cand_err_license")); return
        # ── تحقق من شرط السن حسب الصنف (يُستخدم LICENSE_MIN_AGE للمركزية) ──
        _age = _calc_age(d.get("birth_date", ""))
        if _age is not None:
            _lic = d["license_type"]
            _min_age = LICENSE_MIN_AGE.get(_lic)
            if _min_age is not None and _age < _min_age:
                if _lic == "A1":
                    show_error(T("cand_err_age_a1_reg")); return
                elif _lic in ("A", "F"):
                    show_error(T("cand_err_age_af_reg")); return
                elif _lic == "B":
                    show_error(T("cand_err_age_b_reg")); return
                elif _lic == "C1":
                    show_error(T("cand_err_age_c1_reg")); return
                else:
                    show_error(T("cand_err_age_cde_reg")); return
        if d["is_born_abroad"] and not (d["embassy"] or d["consulate"]):
            if not messagebox.askyesno(T("msg_confirm_del"),
                T("cand_warn_born_abroad")):
                return

        self.on_save(d)
        self.destroy()


# ============================================================================
#  نافذة: إضافة نتيجة امتحان
# ============================================================================

class ExamResultDialog(tk.Toplevel):
    """نافذة إضافة نتيجة امتحان لمترشح محدد."""

    def __init__(self, parent, candidate_id, on_save):
        super().__init__(parent)
        self.candidate_id = candidate_id
        self.on_save = on_save
        self.title(T("exdlg_title"))
        self.geometry("480x400")
        self.minsize(480, 400)
        self.resizable(True, True)
        self.configure(bg=COLOR_BG)
        self.transient(parent)
        self.grab_set()
        self._build()

    def _build(self):
        head = tk.Frame(self, bg=COLOR_PRIMARY, pady=14, padx=20)
        head.pack(fill="x")
        tk.Label(head, text=T("exdlg_header"),
                 font=(FONT_FAMILY, 14, "bold"),
                 bg=COLOR_PRIMARY, fg="white", anchor=A()).pack(side=S())

        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=15)
        wrap.pack(fill="both", expand=True)
        wrap.columnconfigure(0, weight=1); wrap.columnconfigure(1, weight=1)

        def lbl_entry(row, col, text, var, kind="entry", values=None, colspan=1):
            f = tk.Frame(wrap, bg=COLOR_BG)
            f.grid(row=row, column=col, columnspan=colspan,
                   sticky="ew", padx=8, pady=6)
            tk.Label(f, text=text, font=FONT_BOLD, bg=COLOR_BG,
                     fg=COLOR_TEXT, anchor=A()).pack(anchor=A())
            if kind == "combo":
                w = make_combo(f, var, values or [], width=22)
            else:
                w = make_entry(f, var, width=24)
            w.pack(fill="x", ipady=5, pady=(2, 0))

        self.v_type   = tk.StringVar(value=exam_type_opts()[0])
        self.v_date   = tk.StringVar(value=str(date.today()))
        self.v_result = tk.StringVar(value=exam_result_opts()[0])
        self.v_score  = tk.StringVar(value="")
        self.v_notes  = tk.StringVar(value="")

        lbl_entry(0, 0, T("exdlg_f_type"),   self.v_type,   "combo", exam_type_opts())
        lbl_entry(0, 1, T("exdlg_f_date"),   self.v_date,   "entry")
        lbl_entry(1, 0, T("exdlg_f_result"), self.v_result, "combo", exam_result_opts())
        lbl_entry(1, 1, T("exdlg_f_score"),  self.v_score,  "entry")
        lbl_entry(2, 0, T("exdlg_f_notes"),  self.v_notes,  "entry", colspan=2)

        bf = tk.Frame(self, bg=COLOR_BG, pady=10)
        bf.pack(side="bottom", fill="x", padx=20)
        tk.Frame(bf, bg=COLOR_BORDER, height=1).pack(fill="x", pady=(0, 8))
        ModernButton(bf, T("exdlg_btn_cancel"), self.destroy,
                     icon="✗", color=COLOR_TEXT_LIGHT).pack(side=So(), padx=5)
        ModernButton(bf, T("exdlg_btn_save"), self._save,
                     color=COLOR_SUCCESS, size="large").pack(side=S(), padx=5)

    def _save(self):
        exam_date = self.v_date.get().strip()
        exam_type = to_ar_exam_type(self.v_type.get())
        result    = to_ar_exam_result(self.v_result.get())
        if not exam_type or not result:
            show_error(T("exam_err_type_result")); return
        try:
            datetime.strptime(exam_date, "%Y-%m-%d")
        except ValueError:
            show_error(T("err_date_format")); return
        try:
            score = float(self.v_score.get().replace(",", ".") or 0)
        except ValueError:
            score = 0
        self.on_save({
            "candidate_id": self.candidate_id,
            "exam_type":    exam_type,
            "exam_date":    exam_date,
            "result":       result,
            "score":        score,
            "notes":        self.v_notes.get().strip(),
        })
        self.destroy()


# ============================================================================
#  واجهة: المترشحون (مُصلَحة بالكامل)
# ============================================================================

class CandidatesFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.selected_id = None
        self._build()
        self._load_list()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=15)
        wrap.pack(fill="both", expand=True)

        # رأس الصفحة + شريط الأدوات
        head = tk.Frame(wrap, bg=COLOR_BG)
        head.pack(fill="x", pady=(0, 15))
        right_head = tk.Frame(head, bg=COLOR_BG); right_head.pack(side="right")
        tk.Label(right_head, text=T("cand_title"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(anchor=A())
        tk.Label(right_head, text=T("cand_subtitle"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT,
                 anchor=A()).pack(anchor=A())

        left_head = tk.Frame(head, bg=COLOR_BG); left_head.pack(side="left")
        _can_edit = UserDB.has_perm(CURRENT_USER, "edit_candidates")
        if _can_edit:
            ModernButton(left_head, T("cand_new"), self._add_dialog,
                         icon="➕", color=COLOR_SUCCESS).pack(side="right", padx=4)
            ModernButton(left_head, T("cand_edit"), self._edit_dialog,
                         icon="✏️", color=COLOR_PRIMARY).pack(side="right", padx=4)
        ModernButton(left_head, T("cand_exam"), self._open_exam_results,
                     icon="📊", color=COLOR_PURPLE).pack(side="right", padx=4)
        ModernButton(left_head, T("cand_card"), self._print_training_card,
                     icon="📋", color=COLOR_ACCENT).pack(side="right", padx=4)
        ModernButton(left_head, T("cand_print_form"), self._print_application_form,
                     icon="📄", color="#0369a1").pack(side="right", padx=4)
        if _can_edit:
            ModernButton(left_head, T("cand_delete"), self._delete,
                         icon="🗑️", color=COLOR_DANGER).pack(side="right", padx=4)

        # تنبيه إرشادي بارز
        hint = tk.Frame(wrap, bg=COLOR_PRIMARY_LIGHT, padx=15, pady=10)
        hint.pack(fill="x", pady=(0, 10))
        tk.Label(hint,
                 text=T("cand_hint"),
                 font=FONT_BOLD, bg=COLOR_PRIMARY_LIGHT,
                 fg=COLOR_PRIMARY_DARK, anchor=A(),
                 wraplength=1200, justify=J()).pack(anchor=A())

        # شريط البحث
        search_card_outer, search_card = make_card(wrap, padding=15)
        search_card_outer.pack(fill="x", pady=(0, 10))
        tk.Label(search_card, text="🔍", font=(FONT_FAMILY, 14),
                 bg=COLOR_CARD, fg=COLOR_PRIMARY).pack(side="right", padx=(0, 8))
        self.search_var = tk.StringVar()
        self.search_var.trace("w", lambda *a: self._load_list())
        e = make_entry(search_card, self.search_var, width=40)
        e.pack(side="right", fill="x", expand=True, ipady=6)
        tk.Label(search_card, text=T("cand_search"),
                 font=FONT_BOLD, bg=COLOR_CARD,
                 fg=COLOR_TEXT, anchor=A()).pack(side="right", padx=10)

        # جدول المترشحين
        table_outer, table_card = make_card(wrap, padding=10)
        table_outer.pack(fill="both", expand=True)
        cols = ("id", "last_name", "first_name", "national_id", "gender", "phone",
                "license_type", "instructor_name", "total_amount", "registration_date")
        heads = (T("cand_col_num"), T("cand_col_lname"), T("cand_col_fname"),
                 T("cand_col_nid"), T("cand_col_gender"), T("cand_col_phone"),
                 T("cand_col_license"), T("cand_col_inst"), T("cand_col_amount"), T("cand_col_date"))
        widths = (50, 110, 110, 130, 70, 110, 80, 140, 100, 110)
        self.tree = create_treeview(table_card, cols, heads, widths, height=18)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)
        self.tree.bind("<Double-1>", lambda e: self._edit_dialog())

    def _load_list(self):
        rows = CandidateDB.get_all(self.search_var.get())
        values = [(r['id'], r['last_name'], r['first_name'],
                   r.get('national_id', '') or '—', r['gender'], r['phone'],
                   r['license_type'], r.get('instructor_name', '') or '—',
                   f"{r['total_amount']:,.0f} {T('dash_profit_cur')}", r['registration_date'])
                  for r in rows]
        insert_zebra(self.tree, values)

    def _on_select(self, event):
        sel = self.tree.selection()
        if sel:
            self.selected_id = self.tree.item(sel[0])['values'][0]

    def _add_dialog(self):
        CandidateDialog(self, on_save=self._do_add)

    def _do_add(self, data):
        init_pay = data.pop("initial_payment", 0)
        cid = CandidateDB.add(data)
        if init_pay > 0 and cid:
            PaymentDB.add({"candidate_id": cid, "date": str(date.today()), "amount": init_pay, "payment_method": "نقدي", "notes": T("pay_initial_note")})
        self._load_list()
        show_info(T("cand_added"))

    def _edit_dialog(self):
        if not self.selected_id:
            show_error(T("cand_sel_first"))
            return
        cand = CandidateDB.get(self.selected_id)
        if cand:
            CandidateDialog(self, on_save=lambda d: self._do_update(d), candidate=cand)

    def _do_update(self, data):
        CandidateDB.update(self.selected_id, data)
        self._load_list()
        show_info(T("cand_updated"))

    def _delete(self):
        if not self.selected_id:
            show_error(T("cand_sel_first"))
            return
        if confirm_delete(T("cand_del_confirm")):
            CandidateDB.delete(self.selected_id)
            self.selected_id = None
            self._load_list()
            show_info(T("cand_deleted"))

    def _open_exam_results(self):
        """فتح نافذة تعديل المترشح مع الانتقال مباشرة لتبويب نتائج الامتحانات."""
        if not self.selected_id:
            show_error(T("cand_sel_first")); return
        cand = CandidateDB.get(self.selected_id)
        if cand:
            dlg = CandidateDialog(self, on_save=lambda d: self._do_update(d), candidate=cand)
            # الانتقال للتبويب الرابع (الفهرس 3)
            try:
                dlg.children['!notebook'].select(3)
            except Exception:
                try:
                    for child in dlg.winfo_children():
                        if isinstance(child, tk.Frame):
                            for nb in child.winfo_children():
                                if isinstance(nb, ttk.Notebook):
                                    nb.select(3)
                                    break
                except Exception:
                    pass

    def _print_training_card(self):
        if not self.selected_id:
            show_error(T("cand_sel_first")); return
        temp_doc = DocumentsFrame(self)
        temp_doc.selected_candidate_id = self.selected_id
        temp_doc._doc_training_card()
        temp_doc.destroy()

    def _print_application_form(self):
        if not self.selected_id:
            show_error(T("cand_sel_first")); return
        temp_doc = DocumentsFrame(self)
        temp_doc.selected_candidate_id = self.selected_id
        temp_doc._doc_exam_form()
        temp_doc.destroy()


# ============================================================================
#  نافذة منبثقة للممرنين
# ============================================================================

class InstructorDialog(tk.Toplevel):
    def __init__(self, parent, on_save, instructor=None):
        super().__init__(parent)
        self.on_save = on_save
        self.instructor = instructor
        self.vars = {}
        self.title(T("idlg_win_title"))
        self.geometry("850x680")
        self.configure(bg=COLOR_BG)
        self.transient(parent)
        self.grab_set()
        self._build()
        if instructor:
            self._fill(instructor)

    def _build(self):
        head = tk.Frame(self, bg=COLOR_PURPLE, pady=15, padx=20)
        head.pack(fill="x")
        title_text = T("idlg_title_edit") if self.instructor else T("idlg_title_add")
        tk.Label(head, text=title_text, font=(FONT_FAMILY, 15, "bold"),
                 bg=COLOR_PURPLE, fg="white", anchor=A()).pack(side=S())

        wrap = tk.Frame(self, bg=COLOR_BG, padx=15, pady=10)
        wrap.pack(fill="both", expand=True)
        
        # استخدام Notebook لتقسيم البيانات إذا كانت كثيرة لضمان الوضوح
        nb = ttk.Notebook(wrap, style="Modern.TNotebook")
        nb.pack(fill="both", expand=True)
        
        # التبويب 1: البيانات الشخصية والمهنية
        tab1 = tk.Frame(nb, bg=COLOR_CARD, padx=15, pady=10)
        nb.add(tab1, text=T("idlg_tab_basic"))
        
        grid1 = tk.Frame(tab1, bg=COLOR_CARD)
        grid1.pack(fill="both", expand=True)
        grid1.columnconfigure(0, weight=1)
        grid1.columnconfigure(1, weight=1)

        fields1 = [
            (T("idlg_f_fname"),   "first_name",       "entry"),
            (T("idlg_f_lname"),   "last_name",        "entry"),
            (T("cdlg_f_gender"),  "gender",           "combo", gender_opts()),
            (T("idlg_f_bdate"),   "birth_date",       "entry"),
            (T("idlg_f_bplace"),  "birth_place",      "entry"),
            (T("idlg_f_phone"),   "phone",            "entry"),
            (T("idlg_f_addr"),    "address",          "entry"),
            (T("idlg_f_lic_num"), "license_number",   "entry"),
            (T("idlg_f_lic_date"),"license_date",     "entry"),
            (T("idlg_f_cats"),    "categories",       "entry"),
            (T("idlg_f_exp"),     "experience_years", "entry"),
        ]
        
        for i, fi in enumerate(fields1):
            row, col = i // 2, i % 2
            cell = tk.Frame(grid1, bg=COLOR_CARD)
            cell.grid(row=row, column=col, sticky="ew", padx=10, pady=5)
            make_label(cell, fi[0], font=FONT_BOLD).pack(anchor=A())
            v = tk.StringVar(); self.vars[fi[1]] = v
            if fi[2] == "combo":
                w = make_combo(cell, v, fi[3], width=28)
            else:
                w = make_entry(cell, v, width=30)
            w.pack(fill="x", ipady=3, pady=(2, 0))

        # التبويب 2: بيانات العقد والتوظيف
        tab2 = tk.Frame(nb, bg=COLOR_CARD, padx=15, pady=10)
        nb.add(tab2, text=T("idlg_tab_contract"))
        
        grid2 = tk.Frame(tab2, bg=COLOR_CARD)
        grid2.pack(fill="both", expand=True)
        grid2.columnconfigure(0, weight=1)
        grid2.columnconfigure(1, weight=1)
        
        fields2 = [
            (T("idlg_f_dur"),    "contract_duration",    "entry"),
            (T("idlg_f_salary"), "salary",               "entry"),
            (T("idlg_f_start"),  "contract_start_date",  "entry"),
            (T("idlg_f_sign"),   "contract_signing_date","entry"),
            (T("idlg_f_notice"), "notice_period",        "entry"),
        ]
        
        for i, fi in enumerate(fields2):
            row, col = i // 2, i % 2
            cell = tk.Frame(grid2, bg=COLOR_CARD)
            cell.grid(row=row, column=col, sticky="ew", padx=10, pady=5)
            make_label(cell, fi[0], font=FONT_BOLD).pack(anchor=A())
            v = tk.StringVar(); self.vars[fi[1]] = v
            w = make_entry(cell, v, width=30)
            w.pack(fill="x", ipady=3, pady=(2, 0))

        bf = tk.Frame(self, bg=COLOR_BG, pady=12)
        bf.pack(side="bottom", fill="x", padx=20)
        ModernButton(bf, T("idlg_btn_cancel"), self.destroy, icon="✗",
                     color=COLOR_TEXT_LIGHT).pack(side=So(), padx=5)
        ModernButton(bf, T("idlg_btn_save"), self._save, icon="💾",
                     color=COLOR_SUCCESS).pack(side=S(), padx=5)

    def _fill(self, d):
        for k, v in self.vars.items():
            val = str(d.get(k, "") or "")
            if k == "gender":
                val = to_disp_gender(val)
            v.set(val)

    def _save(self):
        d = {k: self.vars[k].get().strip() for k in
             ("first_name","last_name","birth_date","birth_place","phone","address",
              "license_number","license_date","categories","contract_duration",
              "salary","contract_start_date","notice_period","contract_signing_date")}
        d["gender"] = to_ar_gender(self.vars["gender"].get())
        d["experience_years"] = self.vars["experience_years"].get().strip() or "0"
        if not d["first_name"] or not d["last_name"]:
            show_error(T("cand_err_name")); return
        self.on_save(d); self.destroy()


# ============================================================================
#  واجهة: الممرنون
# ============================================================================

class InstructorsFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.selected_id = None
        self._build(); self._load_list()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=15)
        wrap.pack(fill="both", expand=True)

        head = tk.Frame(wrap, bg=COLOR_BG)
        head.pack(fill="x", pady=(0, 15))
        rh = tk.Frame(head, bg=COLOR_BG); rh.pack(side="right")
        tk.Label(rh, text=T("inst_title"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(anchor=A())
        tk.Label(rh, text=T("inst_subtitle"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT,
                 anchor=A()).pack(anchor=A())
        lh = tk.Frame(head, bg=COLOR_BG); lh.pack(side="left")
        ModernButton(lh, T("inst_add"), self._add_dialog,
                     icon="➕", color=COLOR_SUCCESS).pack(side="right", padx=4)
        ModernButton(lh, T("inst_edit"), self._edit_dialog,
                     icon="✏️", color=COLOR_PURPLE).pack(side="right", padx=4)
        ModernButton(lh, T("inst_contract"), self._print_contract,
                     icon="📜", color=COLOR_PRIMARY).pack(side="right", padx=4)
        ModernButton(lh, T("inst_delete"), self._delete,
                     icon="🗑️", color=COLOR_DANGER).pack(side="right", padx=4)

        sco, sc = make_card(wrap, padding=15); sco.pack(fill="x", pady=(0, 10))
        tk.Label(sc, text="🔍", font=(FONT_FAMILY, 14),
                 bg=COLOR_CARD, fg=COLOR_PRIMARY).pack(side="right", padx=(0, 8))
        self.search_var = tk.StringVar()
        self.search_var.trace("w", lambda *a: self._load_list())
        make_entry(sc, self.search_var, width=40).pack(side="right", fill="x",
                                                       expand=True, ipady=6)
        tk.Label(sc, text=T("inst_search"), font=FONT_BOLD,
                 bg=COLOR_CARD, fg=COLOR_TEXT, anchor=A()).pack(side="right", padx=10)

        to, tc = make_card(wrap, padding=10); to.pack(fill="both", expand=True)
        self.tree = create_treeview(tc,
            ("id","last_name","first_name","gender","phone","categories","experience_years"),
            (T("inst_col_num"),T("inst_col_lname"),T("inst_col_fname"),T("inst_col_gender"),
             T("inst_col_phone"),T("inst_col_cats"),T("inst_col_exp")),
            (50,140,140,80,130,120,130), height=18)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)
        self.tree.bind("<Double-1>", lambda e: self._edit_dialog())

    def _load_list(self):
        rows = InstructorDB.get_all(self.search_var.get())
        values = [(r['id'], r['last_name'], r['first_name'], r['gender'],
                   r['phone'], r['categories'], r['experience_years']) for r in rows]
        insert_zebra(self.tree, values)

    def _on_select(self, event):
        sel = self.tree.selection()
        if sel:
            self.selected_id = self.tree.item(sel[0])['values'][0]

    def _add_dialog(self):
        InstructorDialog(self, on_save=self._do_add)

    def _do_add(self, data):
        InstructorDB.add(data); self._load_list()
        show_info(T("inst_added"))

    def _edit_dialog(self):
        if not self.selected_id:
            show_error(T("inst_sel_first")); return
        ins = InstructorDB.get(self.selected_id)
        if ins:
            InstructorDialog(self, on_save=self._do_update, instructor=ins)

    def _do_update(self, data):
        InstructorDB.update(self.selected_id, data); self._load_list()
        show_info(T("inst_updated"))

    def _print_training_card(self):
        if not self.selected_id:
            show_error(T("inst_sel_first")); return
        
        # جلب المترشحين التابعين لهذا الممرن
        conn = get_connection()
        rows = conn.execute("SELECT id, last_name, first_name FROM candidates WHERE instructor_id=?", (self.selected_id,)).fetchall()
        conn.close()
        
        if not rows:
            show_error(T("inst_no_cands")); return
            
        # نافذة اختيار المترشح
        win = tk.Toplevel(self)
        win.title(T("inst_pick_cand"))
        win.geometry("450x500")
        win.configure(bg=COLOR_BG)
        win.transient(self); win.grab_set()
        
        tk.Label(win, text=T("inst_pick_cand_label"), font=FONT_BOLD, bg=COLOR_BG).pack(pady=10)
        
        tree = create_treeview(win, ("id","name"), (T("cand_col_num"),T("inst_col_fname_lname")), (50,300), height=15)
        for r in rows:
            tree.insert("", "end", values=(r['id'], f"{r['last_name']} {r['first_name']}"))
        
        def do_print():
            sel = tree.selection()
            if not sel: return
            cid = tree.item(sel[0])['values'][0]
            # استدعاء دالة الطباعة من واجهة الوثائق (أو بشكل مباشر)
            # سنقوم بمحاكاة اختيار المترشح في واجهة الوثائق
            for tab in self.master.winfo_children():
                if isinstance(tab, DocumentsFrame):
                    tab.selected_candidate_id = cid
                    tab._doc_training_card()
                    win.destroy()
                    return
            # إذا لم نجدها (نادر جداً)، ننشئ نسخة مؤقتة
            temp_doc = DocumentsFrame(self)
            temp_doc.selected_candidate_id = cid
            temp_doc._doc_training_card()
            win.destroy()

        ModernButton(win, T("inst_print_card"), do_print, color=COLOR_PRIMARY).pack(pady=15)

    def _print_contract(self):
        if not self.selected_id:
            show_error(T("inst_sel_first")); return

        ins = InstructorDB.get(self.selected_id)
        school = SchoolInfoDB.get()

        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm

        default_name = (f"contrat_moniteur_{ins.get('last_name','')}.pdf" if LANG == "fr"
                        else f"عقد_الممرن_{ins.get('last_name','')}.pdf")
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/inst_contract_{int(_dtt.now().timestamp())}.pdf"

        c = canvas.Canvas(path, pagesize=A4)
        
        def draw_text(x_cm, y_cm, text, font=ARABIC_FONT, size=11, align="right", bold=False):
            f = ARABIC_FONT_BOLD if bold else font
            c.setFont(f, size)
            text_ar = ar(str(text))
            if align == "right":
                c.drawRightString(x_cm * cm, y_cm * cm, text_ar)
            elif align == "center":
                c.drawCentredString(x_cm * cm, y_cm * cm, text_ar)
            else:
                c.drawString(x_cm * cm, y_cm * cm, text_ar)

        # 1. الترويسة
        draw_text(20.0, 28.5, f"مدرسة تعليم سياقة المركبات ذات المحرك: {school.get('name','')}", ARABIC_FONT_BOLD, 12)
        draw_text(20.0, 27.8, f"العنوان: {school.get('address','')}", size=11)
        draw_text(20.0, 27.1, f"رقم الاعتماد: {school.get('accreditation_number','')}", size=11)
        draw_text(20.0, 26.4, f"رقم السجل التجاري: {school.get('commercial_register','')}", size=11)
        draw_text(20.0, 25.7, f"الرقم الجبائي: {school.get('nif','')}", size=11)

        # 2. العنوان الرئيسي
        c.setLineWidth(1)
        c.rect(7.5*cm, 23.5*cm, 6*cm, 1.2*cm)
        draw_text(10.5, 24.0, "عقد عمل", ARABIC_FONT_BOLD, 22, "center")

        # 3. الأطراف
        y = 22.0
        draw_text(20.0, y, "بين:", ARABIC_FONT_BOLD, 12)
        draw_text(19.0, y, f"مدرسة تعليم سياقة المركبات ذات المحرك المذكورة أعلاه، الممثلة بالسيد مدير مدرسة")
        draw_text(19.0, y-0.6, "تعليم سياقة المركبات ذات المحرك.", align="right")
        draw_text(2.5, y-0.6, "من جهة،", ARABIC_FONT_BOLD, 11)

        y -= 1.8
        draw_text(20.0, y, "و:", ARABIC_FONT_BOLD, 12)
        ins_name = f"{ins['last_name']} {ins['first_name']}"
        draw_text(19.0, y, f"السيد: {ins_name}،   المولود في : {ins['birth_date']} بـ: {ins.get('birth_place','........')}")
        draw_text(19.0, y-0.7, f"الساكن بـ: {ins['address']}")
        draw_text(2.5, y-0.7, "من جهة أخرى،", ARABIC_FONT_BOLD, 11)

        # 4. المواد
        y -= 1.8
        c.setFont(ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y, "المادة الأولى: يوظف السيد:", align="right", bold=True)
        draw_text(15.5, y, f"{ins_name} بصفة ممرن وذلك طبقاً لأحكام القرار الوزاري المشترك")
        draw_text(19.5, y-0.6, "المؤرخ في 1979/09/15 المحدد لكيفيات وشروط استغلال مؤسسات تعليم سياقة المركبات ذات المحرك.")

        y -= 1.4
        dur = ins.get('contract_duration','') or "...................."
        draw_text(20.0, y, f"المادة 02: يبرم عقد العمل هذا لمدة {dur}", bold=True)
        
        y -= 0.8
        sal = ins.get('salary','') or "...................."
        draw_text(20.0, y, f"المادة 03: يستفيد السيد {ins_name} من أجر شهري قدره {sal} دج", bold=True)
        draw_text(18.5, y-0.6, "ويمكن أن يكون هذا الأجر محل مراجعة باتفاق الطرفين.")

        y -= 1.4
        draw_text(20.0, y, f"المادة 04: تمنح للسيد {ins_name} كل الضمانات الواردة في تشريع العمل والضمان الاجتماعي.", bold=True)

        y -= 0.8
        draw_text(20.0, y, f"المادة 05: يتولى السيد {ins_name} المهام التالية:", bold=True)
        tasks = [
            "- تلقين الدروس النظرية والتطبيقية المتعلقة بقانون المرور لفائدة المترشحين لرخصة السياقة.",
            "- تعليم وتمرين المترشحين سياقة المركبات ذات المحرك.",
            "- تعليم وإعلام المترشحين بمختلف النصوص التنظيمية التي تحكم قانون المرور مع التقيد بالبرنامج",
            "  الوطني للتكوين الخاص بسياقة المركبات ذات المحرك الصادر عن وزارة النقل."
        ]
        for task in tasks:
            y -= 0.6
            draw_text(19.0, y, task)

        y -= 1.0
        draw_text(20.0, y, "المادة 06: يقع على عاتق الممرن أو مدير مدرسة تعليم سياقة المركبات ذات المحرك حسب الحالة إعداد البطاقات", bold=True)
        draw_text(19.5, y-0.6, "الخاصة بكل الدروس المقدمة للمترشحين في مجال تعليم سياقة المركبات وفقاً للبرنامج")
        draw_text(19.5, y-1.2, "الوطني المذكور أعلاه.")

        y -= 2.0
        not_p = ins.get('notice_period','') or "...."
        draw_text(20.0, y, f"المادة 07: في حالة نقض العقد الحالي، على الطرفين القيام بالإخطار بمدة لا تقل عن {not_p} شهر.", bold=True)
        
        y -= 0.8
        st_d = ins.get('contract_start_date','') or "...................."
        draw_text(20.0, y, f"المادة 08: يسري مفعول هذا العقد ابتداءً من {st_d}", bold=True)

        # 5. الخاتمة والتوقيعات
        y -= 1.5
        wilaya = _no_wnum(school.get('wilaya', '').strip()) or '........'
        sig_date = ins.get('contract_signing_date','') or "...................."
        draw_text(12.0, y, f"حرر بـ: {wilaya}              في: {sig_date}", size=12)

        y -= 1.5
        draw_text(17.5, y, "اسم الممرن ولقبه", ARABIC_FONT_BOLD, 12, "center")
        draw_text(17.5, y-0.6, "قرىء وصودق عليه", size=10, align="center")
        
        draw_text(5.5, y, "مدير مدرسة تعليم سياقة", ARABIC_FONT_BOLD, 12, "center")
        draw_text(5.5, y-0.6, "المركبات ذات المحرك", ARABIC_FONT_BOLD, 12, "center")

        c.save()
        self._trigger_print(path, T("doc_contract"), default_name=default_name)

    def _trigger_print(self, path, title=None, default_name=None):
        """يعرض حوار الطابعة أولاً ثم حوار الحفظ ثم يرسل للطابعة."""
        if title is None:
            title = T("print_doc_lbl")
        printers = self._get_printers()

        dlg = tk.Toplevel()
        dlg.title(T("print_dlg_title"))
        dlg.resizable(True, True)
        dlg.grab_set()
        dlg.configure(bg=COLOR_BG)

        w, h = 440, 210
        dlg.minsize(w, h)
        dlg.update_idletasks()
        x = (dlg.winfo_screenwidth() - w) // 2
        y = (dlg.winfo_screenheight() - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")

        tk.Label(dlg, text=f"{T('print_label')} {title}",
                 font=FONT_BOLD, bg=COLOR_BG, fg=COLOR_HEADER,
                 anchor=A()).pack(fill="x", padx=20, pady=(18, 4))

        tk.Label(dlg, text=T("print_choose"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT,
                 anchor=A()).pack(fill="x", padx=20)

        printer_var = tk.StringVar()
        if printers:
            printer_var.set(printers[0])

        cb = ttk.Combobox(dlg, textvariable=printer_var, values=printers,
                          font=FONT_MAIN, state="readonly",
                          style="Modern.TCombobox")
        cb.pack(fill="x", padx=20, pady=8)

        btn_frame = tk.Frame(dlg, bg=COLOR_BG)
        btn_frame.pack(fill="x", padx=20, pady=10)

        result = {"action": None, "path": path}

        def do_print():
            import shutil
            dn = default_name or (title + ".pdf")
            save_path = filedialog.asksaveasfilename(
                defaultextension=".pdf",
                filetypes=[("PDF Files", "*.pdf"), ("All Files", "*.*")],
                initialfile=dn)
            if save_path:
                try:
                    shutil.copy2(path, save_path)
                    result["path"] = save_path
                except Exception:
                    result["path"] = path
            result["action"] = "print"
            dlg.destroy()

        def do_open():
            result["action"] = "open"
            dlg.destroy()

        def do_cancel():
            result["action"] = "cancel"
            dlg.destroy()

        tk.Button(btn_frame, text=T("print_btn"), font=FONT_BOLD,
                  bg=COLOR_PRIMARY, fg="white", relief="flat",
                  padx=18, pady=6, cursor="hand2",
                  command=do_print).pack(side=S(), padx=(6, 0))
        tk.Button(btn_frame, text=T("print_open"), font=FONT_MAIN,
                  bg=COLOR_INFO, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2",
                  command=do_open).pack(side=S(), padx=6)
        tk.Button(btn_frame, text=T("print_cancel"), font=FONT_MAIN,
                  bg=COLOR_BORDER, fg=COLOR_TEXT, relief="flat",
                  padx=12, pady=6, cursor="hand2",
                  command=do_cancel).pack(side=So())

        dlg.wait_window()

        if result["action"] == "print":
            selected = printer_var.get()
            self._send_to_printer(result["path"], selected, title)
        elif result["action"] == "open":
            try:
                os.startfile(result["path"])
            except Exception:
                try:
                    import subprocess, sys
                    if sys.platform == "darwin":
                        subprocess.run(["open", result["path"]])
                    else:
                        subprocess.run(["xdg-open", result["path"]])
                except Exception as e:
                    show_error(f"{T('print_open_err')} {e}")

    def _get_printers(self):
        """يجلب قائمة الطابعات المثبتة على النظام."""
        printers = []
        try:
            import sys
            if sys.platform == "win32":
                try:
                    import winreg
                    key = winreg.OpenKey(
                        winreg.HKEY_LOCAL_MACHINE,
                        r"SYSTEM\CurrentControlSet\Control\Print\Printers")
                    i = 0
                    while True:
                        try:
                            printers.append(winreg.EnumKey(key, i))
                            i += 1
                        except OSError:
                            break
                except Exception:
                    import subprocess
                    result = subprocess.run(
                        ["wmic", "printer", "get", "name"],
                        capture_output=True, text=True)
                    for line in result.stdout.splitlines():
                        line = line.strip()
                        if line and line.lower() != "name":
                            printers.append(line)
            else:
                import subprocess
                result = subprocess.run(
                    ["lpstat", "-a"], capture_output=True, text=True)
                for line in result.stdout.splitlines():
                    parts = line.split()
                    if parts:
                        printers.append(parts[0])
        except Exception:
            pass
        if not printers:
            printers = [T("print_default")]
        return printers

    def _send_to_printer(self, path, printer_name, title):
        """يرسل ملف PDF إلى الطابعة المحددة."""
        import sys, subprocess
        _default = T("print_default")
        try:
            if sys.platform == "win32":
                if printer_name and printer_name != _default:
                    try:
                        subprocess.run(
                            ["SumatraPDF", "-print-to", printer_name, path],
                            capture_output=True)
                        show_info(f"{T('print_sent')} {title} {T('print_to')}\n{printer_name}")
                        return
                    except Exception:
                        pass
                os.startfile(path, 'print')
                show_info(T("print_ok"))
            else:
                cmd = ["lp", path]
                if printer_name and printer_name != _default:
                    cmd = ["lp", "-d", printer_name, path]
                subprocess.run(cmd)
                show_info(f"{T('print_sent')} {title} {T('print_to')}\n{printer_name}")
        except Exception as e:
            show_error(f"{T('print_err_title')}\n{e}\n\n{T('print_fallback')}")
            try:
                os.startfile(path)
            except Exception:
                pass

    def _delete(self):
        if not self.selected_id:
            show_error(T("inst_sel_first")); return
        if confirm_delete(T("inst_del_confirm")):
            InstructorDB.delete(self.selected_id)
            self.selected_id = None
            self._load_list()
            show_info(T("inst_deleted"))


# ============================================================================
#  واجهة: مراحل التكوين
# ============================================================================

class TrainingFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.selected_candidate_id = None
        self.selected_stage_id = None
        self.stage_vars = {}
        self.current_stages = []
        self._build(); self._load_candidates()

    @staticmethod
    def _is_unlocked(stages, stage_type):
        """مرحلة مفتوحة فقط إذا كل المراحل السابقة بحالة 'ناجح'."""
        try:
            idx = STAGE_ORDER.index(stage_type)
        except ValueError:
            return True
        if idx == 0:
            return True
        by_type = {}
        for s in stages:
            if s['stage_type'] not in by_type or s['status'] == STATUS_PASS:
                by_type[s['stage_type']] = s
        for prev_type in STAGE_ORDER[:idx]:
            prev = by_type.get(prev_type)
            if not prev or prev.get('status') != STATUS_PASS:
                return False
        return True

    def _get_active_stage(self):
        """تُعيد أول مرحلة غير مكتملة وفق الترتيب الصحيح (code→creneau→circuit)."""
        if not self.selected_candidate_id: return None
        stages = TrainingDB.get_by_candidate(self.selected_candidate_id)
        if not stages: return None
        # أنشئ قاموساً: stage_type → أحدث سجل (بحسب ID)
        by_type = {}
        for s in stages:
            if s['stage_type'] not in by_type or s['id'] > by_type[s['stage_type']]['id']:
                by_type[s['stage_type']] = s
        # أعِد أول مرحلة في الترتيب ليست ناجحة
        for stage_type in STAGE_ORDER:
            s = by_type.get(stage_type)
            if s is None:
                continue
            if s['status'] != STATUS_PASS:
                return s
        # كل المراحل ناجحة — أعد آخر مرحلة (circuit) لعرض "تخرج بنجاح"
        for stage_type in reversed(STAGE_ORDER):
            if stage_type in by_type:
                return by_type[stage_type]
        return None

    def _get_candidate_name(self):
        if not self.selected_candidate_id: return ""
        conn = get_connection()
        c = conn.execute("SELECT first_name, last_name FROM candidates WHERE id=?", (self.selected_candidate_id,)).fetchone()
        conn.close()
        return f"{c['first_name']} {c['last_name']}" if c else ""

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=15)
        wrap.pack(fill="both", expand=True)

        tk.Label(wrap, text=T("train_title"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(fill="x", pady=0)
        tk.Label(wrap, text=T("train_subtitle"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT,
                 anchor=A()).pack(fill="x", pady=(0, 10))

        main_container = tk.Frame(wrap, bg=COLOR_BG)
        main_container.pack(fill="both", expand=True)

        # يمين: لوحة التحكم والعمليات السريعة
        right_frame = tk.Frame(main_container, bg=COLOR_BG, width=320)
        right_frame.pack(side="right", fill="y", padx=(10, 0))
        right_frame.pack_propagate(False)

        fo, fc = make_card(right_frame); fo.pack(fill="both", expand=True)
        section_title(fc, T("train_sec_current"), icon="🎯")

        self.lbl_cand_name = tk.Label(fc, text=T("train_choose_cand"), font=(FONT_FAMILY, 14, "bold"), bg=COLOR_CARD, fg=COLOR_HEADER)
        self.lbl_cand_name.pack(pady=5)
        
        lbl_hours = tk.Label(fc, text=T("train_hours_info"), font=(FONT_FAMILY, 10), bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT)
        lbl_hours.pack(pady=(0, 10))

        self.lbl_current_stage = tk.Label(fc, text=T("train_stage_init"), font=(FONT_FAMILY, 14, "bold"), bg=COLOR_CARD, fg=COLOR_PRIMARY)
        self.lbl_current_stage.pack(pady=5)
        
        self.lbl_stage_status = tk.Label(fc, text=T("train_status_init"), font=FONT_MAIN, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT)
        self.lbl_stage_status.pack(pady=5)

        self.btn_exam_results = ModernButton(fc, T("train_exam_ttl"), self._show_exam_results_window, icon="📋", color=COLOR_PURPLE)
        self.btn_exam_results.pack(fill="x", pady=(15, 5), ipady=2)

        self.btn_history = ModernButton(fc, T("train_history_ttl"), self._show_history_window, icon="📜", color=COLOR_PRIMARY)
        self.btn_history.pack(fill="x", pady=(0, 10), ipady=2)

        action_btns = tk.Frame(fc, bg=COLOR_CARD)
        action_btns.pack(fill="x", pady=5)

        self.btn_pass = ModernButton(action_btns, T("train_btn_pass"), self._quick_pass, icon="✅", color=COLOR_SUCCESS)
        self.btn_pass.pack(side=S(), fill="x", expand=True, padx=(0, 2), ipady=2)

        self.btn_fail = ModernButton(action_btns, T("train_btn_fail"), self._quick_fail, icon="❌", color=COLOR_WARNING)
        self.btn_fail.pack(side=So(), fill="x", expand=True, padx=(2, 0), ipady=2)

        self._set_buttons_state("disabled")

        # يسار: شريط البحث + المترشحين + المراحل
        left_frame = tk.Frame(main_container, bg=COLOR_BG)
        left_frame.pack(side="left", fill="both", expand=True)

        # شريط البحث
        sco, sc = make_card(left_frame, padding=5); sco.pack(fill="x", pady=(0, 5))
        tk.Label(sc, text="🔍", font=(FONT_FAMILY, 14),
                 bg=COLOR_CARD, fg=COLOR_PRIMARY).pack(side="right", padx=(0, 8))
        self.search_var = tk.StringVar()
        self.search_var.trace("w", lambda *a: self._load_candidates())
        make_entry(sc, self.search_var, width=30).pack(side="right", fill="x", expand=True, ipady=4)
        tk.Label(sc, text=T("train_search_cand"), font=FONT_BOLD,
                 bg=COLOR_CARD, fg=COLOR_TEXT, anchor=A()).pack(side=S(), padx=10)

        # قائمة المترشحين
        co, cc = make_card(left_frame, padding=5); co.pack(fill="both", expand=True, pady=(0, 5))
        section_title(cc, T("train_choose_cand_sec"), icon="👤")
        self.cand_tree = create_treeview(cc,
            ("id","last_name","first_name","phone","license_type"),
            (T("train_col_num"),T("cand_col_last"),T("cand_col_first"),T("cdlg_f_phone"),T("cand_col_lic")),
            (50,150,150,130,100), height=10)
        self.cand_tree.bind("<<TreeviewSelect>>", self._on_candidate_select)

    def _load_candidates(self):
        rows = CandidateDB.get_all(self.search_var.get())
        values = [(r['id'], r['last_name'], r['first_name'],
                   r['phone'], r['license_type']) for r in rows]
        insert_zebra(self.cand_tree, values)

    def _on_candidate_select(self, event):
        sel = self.cand_tree.selection()
        if not sel: return
        self.selected_candidate_id = self.cand_tree.item(sel[0])['values'][0]
        self._load_stages()
        self._update_action_panel()

    def _set_buttons_state(self, state):
        self.btn_pass.config(state=state)
        self.btn_fail.config(state=state)
        has_cand = "normal" if self.selected_candidate_id else "disabled"
        self.btn_history.config(state=has_cand)
        self.btn_exam_results.config(state=has_cand)

    def _update_action_panel(self):
        name = self._get_candidate_name()
        self.lbl_cand_name.config(text=f"{T('train_cand_label')} {name}")

        active = self._get_active_stage()
        if not active:
            self.lbl_current_stage.config(text=T("train_no_stages"))
            self.lbl_stage_status.config(text="")
            self._set_buttons_state("disabled")
            return

        stage_name = STAGE_LABELS.get(active['stage_type'], active['stage_type'])

        if active['status'] == STATUS_PASS and active['stage_type'] == "circuit":
            self.lbl_current_stage.config(text=T("train_graduated"))
            self.lbl_stage_status.config(text=T("train_all_done"))
            self._set_buttons_state("disabled")
            return

        # ── تخرج A1 بعد نجاح الكود مباشرةً ──────────────────────────────────
        if active['status'] == STATUS_PASS and active['stage_type'] == "code":
            conn = get_connection()
            _r = conn.execute("SELECT license_type FROM candidates WHERE id=?",
                              (self.selected_candidate_id,)).fetchone()
            conn.close()
            if _r and _r["license_type"] in LICENSE_CODE_ONLY:
                self.lbl_current_stage.config(text=T("train_graduated"))
                self.lbl_stage_status.config(text=T("train_all_done"))
                self._set_buttons_state("disabled")
                return

        # تحقق من أن المرحلة مفتوحة (المراحل السابقة ناجحة)
        stages_all = self.current_stages
        unlocked = self._is_unlocked(stages_all, active['stage_type'])

        if not unlocked:
            # المرحلة مقفلة — أظهر رسالة وعطّل الأزرار
            idx = STAGE_ORDER.index(active['stage_type'])
            prev_name = STAGE_LABELS.get(STAGE_ORDER[idx - 1], STAGE_ORDER[idx - 1])
            self.lbl_current_stage.config(
                text=f"🔒 {stage_name}",
                fg=COLOR_WARNING)
            self.lbl_stage_status.config(
                text=f"{T('train_must_pass')} {prev_name} {T('train_first')}",
                fg=COLOR_DANGER)
            self._set_buttons_state("disabled")
        else:
            # ── جلب بيانات المترشح (صنف + تاريخ ميلاد) مرة واحدة ────────────
            conn = get_connection()
            _crow = conn.execute(
                "SELECT birth_date, license_type FROM candidates WHERE id=?",
                (self.selected_candidate_id,)).fetchone()
            conn.close()
            _clic = _crow["license_type"] if _crow else ""

            # ── قفل A1: لا يُسمح إلا بمرحلة الكود ──────────────────────────
            if _clic in LICENSE_CODE_ONLY and active['stage_type'] != "code":
                self.lbl_current_stage.config(
                    text=f"🔒 {stage_name}",
                    fg=COLOR_WARNING)
                self.lbl_stage_status.config(
                    text=T("train_err_a1_code_only"),
                    fg=COLOR_DANGER)
                self._set_buttons_state("disabled")
                return

            # ── قفل السيركوي بشرط السن ───────────────────────────────────────
            _circuit_locked = False
            if active['stage_type'] == "circuit" and _crow:
                _min_circ = LICENSE_CIRCUIT_AGE.get(_clic)
                if _min_circ is not None:
                    _cage = _calc_age(_crow["birth_date"])
                    if _cage is not None and _cage < _min_circ:
                        _circuit_locked = True

            if _circuit_locked:
                self.lbl_current_stage.config(
                    text=f"🔒 {stage_name}",
                    fg=COLOR_WARNING)
                self.lbl_stage_status.config(
                    text=T("train_err_age_circuit"),
                    fg=COLOR_DANGER)
                self._set_buttons_state("disabled")
            elif active['status'] == STATUS_PASS:
                self.lbl_current_stage.config(text=f"{T('train_stage_lbl')} {stage_name}",
                                              fg=COLOR_PRIMARY)
                self.lbl_stage_status.config(text=f"{T('train_status_lbl')} {active['status']}",
                                             fg=COLOR_TEXT_LIGHT)
                self._set_buttons_state("disabled")
            else:
                self.lbl_current_stage.config(text=f"{T('train_stage_lbl')} {stage_name}",
                                              fg=COLOR_PRIMARY)
                self.lbl_stage_status.config(text=f"{T('train_status_lbl')} {active['status']}",
                                             fg=COLOR_TEXT_LIGHT)
                self._set_buttons_state("normal")

    def _load_stages(self):
        if not self.selected_candidate_id:
            self.current_stages = []; return
        stages_raw = TrainingDB.get_by_candidate(self.selected_candidate_id)
        order_idx = {t: i for i, t in enumerate(STAGE_ORDER)}
        self.current_stages = sorted(
            stages_raw, key=lambda s: (order_idx.get(s['stage_type'], 99), s['id']))

    def _show_history_window(self):
        if not self.selected_candidate_id: return
        win = tk.Toplevel(self)
        win.title(f"{T('train_history_ttl')} - {self._get_candidate_name()}")
        win.geometry("900x450")
        win.configure(bg=COLOR_BG)
        win.transient(self.winfo_toplevel())

        tk.Label(win, text=f"{T('train_history_cand')} {self._get_candidate_name()}",
                 font=(FONT_FAMILY, 16, "bold"), bg=COLOR_BG, fg=COLOR_HEADER).pack(pady=15)

        tree = create_treeview(win,
            ("id","stage_type","status","start_date","end_date","score","notes"),
            (T("train_col_num"),T("train_col_stage"),T("train_col_status"),T("train_col_start"),T("train_col_end"),T("train_col_score"),T("train_col_notes")),
            (40,150,120,110,110,80,150), height=15)

        values = []
        for s in self.current_stages:
            unlocked = self._is_unlocked(self.current_stages, s['stage_type'])
            label = STAGE_LABELS.get(s['stage_type'], s['stage_type'])
            if not unlocked:
                label = f"🔒  {label}  ({T('train_locked_lbl')})"
            elif s['status'] == STATUS_PASS:
                label = f"✅  {label}"
            elif s['status'] == "راسب":
                label = f"❌  {label}"
            else:
                label = f"▶  {label}"
            values.append((s['id'], label, s['status'],
                           s['start_date'] or "", s['end_date'] or "",
                           s['score'] or "", s['notes'] or ""))
        insert_zebra(tree, values)

        ModernButton(win, T("btn_close"), win.destroy, color=COLOR_TEXT_LIGHT).pack(pady=15)

    def _show_exam_results_window(self):
        if not self.selected_candidate_id: return
        cid  = self.selected_candidate_id
        name = self._get_candidate_name()

        win = tk.Toplevel(self)
        win.title(f"{T('train_exam_ttl')} - {name}")
        win.geometry("1000x620")
        win.configure(bg=COLOR_BG)
        win.transient(self.winfo_toplevel())

        # ── العنوان ──────────────────────────────────────────────────
        hdr = tk.Frame(win, bg=COLOR_PRIMARY, padx=20, pady=12)
        hdr.pack(fill="x")
        tk.Label(hdr, text=f"{T('train_exam_cand')} {name}",
                 font=(FONT_FAMILY, 16, "bold"), bg=COLOR_PRIMARY, fg="white").pack(side=S())

        # ── صف الإحصائيات السريعة ────────────────────────────────────
        stats_frame = tk.Frame(win, bg=COLOR_BG, padx=15, pady=10)
        stats_frame.pack(fill="x")
        self._exam_stats_frame = stats_frame

        # ── شريط الأدوات ─────────────────────────────────────────────
        toolbar = tk.Frame(win, bg=COLOR_BG, padx=15, pady=0)
        toolbar.pack(fill="x")

        stage_var = tk.StringVar(value=list(STAGE_LABELS.keys())[0])
        stage_labels_list = [f"{v}  ({k})" for k, v in STAGE_LABELS.items()]
        stage_keys = list(STAGE_LABELS.keys())

        tk.Label(toolbar, text=T("train_choose_stage"), font=FONT_BOLD,
                 bg=COLOR_BG, fg=COLOR_TEXT).pack(side=S(), padx=(0, 6))
        stage_combo = make_combo(toolbar, stage_var, stage_labels_list, width=28)
        stage_combo.current(0)
        stage_combo.pack(side=S())

        ModernButton(toolbar, T("train_add_result"), icon="➕", color=COLOR_SUCCESS,
                     command=lambda: self._add_exam_attempt_dialog(
                         win, cid, stage_keys[stage_combo.current()],
                         lambda: self._refresh_exam_window(win, cid, tree_ref, self._exam_stats_frame))
                     ).pack(side=S(), padx=(8, 0), ipady=2)

        ModernButton(toolbar, T("train_del_sel"), icon="🗑️", color=COLOR_DANGER,
                     command=lambda: self._delete_exam_attempt(cid, tree_ref,
                         lambda: self._refresh_exam_window(win, cid, tree_ref, self._exam_stats_frame))
                     ).pack(side=So(), padx=(0, 0), ipady=2)

        # ── جدول النتائج ─────────────────────────────────────────────
        table_frame = tk.Frame(win, bg=COLOR_BG, padx=15, pady=5)
        table_frame.pack(fill="both", expand=True)

        tree_ref = create_treeview(table_frame,
            ("id","stage","exam_date","score","result","notes"),
            (T("train_col_num"),T("train_col_stage"),T("train_col_exam_date"),T("train_col_score40"),T("train_col_score"),T("train_col_notes")),
            (40, 180, 120, 110, 100, 220), height=15)

        ModernButton(win, T("btn_close"), win.destroy, color=COLOR_TEXT_LIGHT).pack(pady=8)

        self._refresh_exam_window(win, cid, tree_ref, self._exam_stats_frame)

    def _refresh_exam_window(self, win, cid, tree, stats_frame):
        attempts = ExamAttemptsDB.get_by_candidate(cid)
        values = []
        for a in attempts:
            stage_label = STAGE_LABELS.get(a['stage_type'], a['stage_type'])
            result_icon = T("train_res_pass") if a['result'] == STATUS_PASS else T("train_res_fail")
            values.append((a['id'], stage_label, a['exam_date'],
                           a['score'] if a['score'] else "—",
                           result_icon, a['notes'] or ""))
        insert_zebra(tree, values)

        for w in stats_frame.winfo_children():
            w.destroy()

        stats_by_stage = {s['stage_type']: s
                          for s in ExamAttemptsDB.get_stats_by_stage()}

        for code, label in STAGE_LABELS.items():
            s = stats_by_stage.get(code, {'total': 0, 'passed': 0})
            total  = s.get('total', 0) or 0
            passed = s.get('passed', 0) or 0
            rate   = (passed / total * 100) if total > 0 else 0
            color  = COLOR_SUCCESS if rate >= 50 else (COLOR_DANGER if total > 0 else COLOR_TEXT_LIGHT)

            sc = tk.Frame(stats_frame, bg=COLOR_CARD, padx=14, pady=10,
                          highlightthickness=1, highlightbackground=COLOR_BORDER)
            sc.pack(side="right", fill="both", expand=True, padx=6)
            tk.Label(sc, text=label, font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_TEXT).pack(anchor=A())
            tk.Label(sc, text=f"{rate:.0f}%  {T('dash_pct_pass')}", font=(FONT_FAMILY, 18, "bold"),
                     bg=COLOR_CARD, fg=color).pack(anchor=A())
            tk.Label(sc, text=f"{T('dash_tries')}: {total}  |  {T('dash_pass')}: {passed}  |  {T('dash_fail')}: {total - passed}",
                     font=FONT_TINY, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT).pack(anchor=A())

    def _add_exam_attempt_dialog(self, parent_win, cid, stage_type, on_save):
        dlg = tk.Toplevel(parent_win)
        dlg.title(T("train_add_result"))
        dlg.geometry("440x360")
        dlg.configure(bg=COLOR_BG)
        dlg.transient(parent_win)
        dlg.grab_set()

        tk.Label(dlg, text=T("train_exam_new"),
                 font=(FONT_FAMILY, 15, "bold"), bg=COLOR_BG, fg=COLOR_HEADER).pack(pady=(18, 10))

        outer, body = make_card(dlg, padding=18)
        outer.pack(fill="both", expand=True, padx=15, pady=(0, 10))

        vars_ = {}

        def field_row(label, key, widget_type="entry", options=None, default=""):
            row = tk.Frame(body, bg=COLOR_CARD); row.pack(fill="x", pady=5)
            tk.Label(row, text=label, font=FONT_BOLD, bg=COLOR_CARD,
                     fg=COLOR_TEXT, width=14, anchor=A()).pack(side="right")
            v = tk.StringVar(value=default)
            vars_[key] = v
            if widget_type == "combo":
                w = make_combo(row, v, options, width=18)
                w.set(options[0] if options else "")
                if default:
                    w.set(default)
            else:
                w = make_entry(row, v, width=20)
            w.pack(side="left", fill="x", expand=True, padx=(8, 0), ipady=3)

        stage_label = STAGE_LABELS.get(stage_type, stage_type)
        tk.Label(body, text=f"{T('train_stage_field')} {stage_label}",
                 font=(FONT_FAMILY, 12, "bold"), bg=COLOR_CARD,
                 fg=COLOR_PRIMARY, anchor=A()).pack(fill="x", pady=(0, 8))

        field_row(T("train_date_field"),  "exam_date", default=str(date.today()))
        field_row(T("train_score_field"), "score", default="0")
        field_row(T("train_result_field"),"result", "combo",
                  [exam_result_opts()[1], exam_result_opts()[0]],
                  default=exam_result_opts()[1])
        field_row(T("train_notes_field"), "notes", default="")

        def _save():
            try:
                score_val = float(vars_['score'].get() or 0)
            except ValueError:
                show_error(T("train_err_score"))
                return
            ExamAttemptsDB.add({
                'candidate_id': cid,
                'stage_type':   stage_type,
                'exam_date':    vars_['exam_date'].get() or str(date.today()),
                'score':        score_val,
                'result':       vars_['result'].get(),
                'notes':        vars_['notes'].get(),
            })
            dlg.destroy()
            on_save()
            show_info(T("train_result_saved"))

        btn_frame = tk.Frame(dlg, bg=COLOR_BG); btn_frame.pack(fill="x", padx=15, pady=(0, 12))
        ModernButton(btn_frame, T("train_btn_save"), _save, icon="💾", color=COLOR_SUCCESS).pack(side=S(), ipady=2)
        ModernButton(btn_frame, T("train_btn_cancel"), dlg.destroy, color=COLOR_TEXT_LIGHT).pack(side=So(), ipady=2)

    def _delete_exam_attempt(self, cid, tree, on_delete):
        sel = tree.selection()
        if not sel:
            show_error(T("train_sel_first"))
            return
        attempt_id = tree.item(sel[0])['values'][0]
        if not confirm_delete(T("train_del_confirm")):
            return
        ExamAttemptsDB.delete(attempt_id)
        on_delete()
        show_info(T("train_deleted"))

    def _quick_pass(self):
        active = self._get_active_stage()
        if not active: return

        # حماية: لا نجاح إن كانت المرحلة مقفلة
        if not self._is_unlocked(self.current_stages, active['stage_type']):
            idx = STAGE_ORDER.index(active['stage_type'])
            prev_name = STAGE_LABELS.get(STAGE_ORDER[idx - 1], STAGE_ORDER[idx - 1])
            show_error(f"{T('train_locked_pass')} {prev_name}")
            return

        # ── جلب بيانات المترشح (صنف + تاريخ ميلاد) ─────────────────────────
        conn = get_connection()
        _crow = conn.execute(
            "SELECT birth_date, license_type FROM candidates WHERE id=?",
            (self.selected_candidate_id,)).fetchone()
        conn.close()
        _clic = _crow["license_type"] if _crow else ""

        # حماية: A1 لا يتجاوز مرحلة الكود
        if _clic in LICENSE_CODE_ONLY and active['stage_type'] != "code":
            show_error(T("train_err_a1_code_only"))
            return

        # حماية: شرط سن السيركوي (B, A, F)
        if active['stage_type'] == "circuit" and _crow:
            _min_circ = LICENSE_CIRCUIT_AGE.get(_clic)
            if _min_circ is not None:
                _cage = _calc_age(_crow["birth_date"])
                if _cage is not None and _cage < _min_circ:
                    show_error(T("train_err_age_circuit"))
                    return

        # 1. تحديث المرحلة الحالية إلى ناجح
        from datetime import date
        today = str(date.today())
        TrainingDB.update(active['id'], {
            "status": STATUS_PASS, "start_date": today, "end_date": today,
            "score": 0, "notes": ""})

        # 2. إضافة المرحلة التالية — لا تُضاف لأصناف الكود فقط (A1)
        idx = STAGE_ORDER.index(active['stage_type'])
        if idx + 1 < len(STAGE_ORDER) and _clic not in LICENSE_CODE_ONLY:
            next_stage = STAGE_ORDER[idx + 1]
            existing = TrainingDB.get_by_candidate(self.selected_candidate_id)
            has_next = any(s['stage_type'] == next_stage for s in existing)
            if not has_next:
                TrainingDB.add(self.selected_candidate_id, next_stage)

        self._load_stages()
        self._update_action_panel()
        show_info(T("train_pass_recorded"))

    def _quick_fail(self):
        active = self._get_active_stage()
        if not active: return

        # حماية: لا رسوب إن كانت المرحلة مقفلة
        if not self._is_unlocked(self.current_stages, active['stage_type']):
            idx = STAGE_ORDER.index(active['stage_type'])
            prev_name = STAGE_LABELS.get(STAGE_ORDER[idx - 1], STAGE_ORDER[idx - 1])
            show_error(f"{T('train_locked_fail')} {prev_name}")
            return

        # 1. تحديث المرحلة الحالية إلى راسب
        TrainingDB.update(active['id'], {
            "status": "راسب", "start_date": active['start_date'], "end_date": active['end_date'],
            "score": 0, "notes": ""})

        # 2. إضافة نفس المرحلة كمحاولة جديدة
        TrainingDB.add(self.selected_candidate_id, active['stage_type'])

        self._load_stages()
        self._update_action_panel()
        show_info(T("train_fail_recorded"))


# ============================================================================
#  واجهة: المدفوعات
# ============================================================================

class PaymentsFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.selected_candidate_id = None
        self.selected_payment_id = None
        self.vars = {}
        self._build(); self._load_candidates()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=10, pady=5)
        wrap.pack(fill="both", expand=True)
        tk.Label(wrap, text=T("pay_title"), font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(fill="x", pady=(0, 5))
        tk.Label(wrap, text=T("pay_subtitle"), font=FONT_MAIN,
                 bg=COLOR_BG, fg=COLOR_TEXT_LIGHT, anchor=A()).pack(fill="x", pady=(0, 10))

        # حاوية رئيسية تنقسم ليمين ويسار
        main_container = tk.Frame(wrap, bg=COLOR_BG)
        main_container.pack(fill="both", expand=True)

        # يمين: الملخص المالي + نموذج إضافة دفعة
        right = tk.Frame(main_container, bg=COLOR_BG, width=320)
        right.pack(side="right", fill="y", padx=(10, 0))
        right.pack_propagate(False)

        sm = tk.Frame(right, bg=COLOR_PRIMARY, padx=10, pady=5)
        sm.pack(fill="x", pady=(0, 5))
        
        row_sm1 = tk.Frame(sm, bg=COLOR_PRIMARY)
        row_sm1.pack(fill="x")
        self.lbl_total = tk.Label(row_sm1, text=T("pay_total_lbl"), font=FONT_BOLD, bg=COLOR_PRIMARY, fg="white")
        self.lbl_total.pack(anchor="center")
        
        row_sm2 = tk.Frame(sm, bg=COLOR_PRIMARY)
        row_sm2.pack(fill="x", pady=(2, 0))
        self.lbl_paid = tk.Label(row_sm2, text=T("pay_paid_lbl"), font=FONT_BOLD, bg=COLOR_PRIMARY, fg="#a7f3d0")
        self.lbl_paid.pack(side="right", expand=True)
        self.lbl_remaining = tk.Label(row_sm2, text=T("pay_remain_lbl"), font=(FONT_FAMILY, 12, "bold"), bg=COLOR_PRIMARY, fg=COLOR_ACCENT)
        self.lbl_remaining.pack(side="left", expand=True)

        fo, fc = make_card(right); fo.pack(fill="x", pady=(0, 5))
        
        # نقل زر السجل ليكون في الأعلى للوصول السريع وملاحظة واضحة
        ModernButton(fc, T("pay_history"), self._show_history_window, icon="📜", color=COLOR_PRIMARY).pack(fill="x", pady=(0, 10), ipady=2)
        
        section_title(fc, T("pay_add_section"), icon="➕")
        
        fields = [(T("pay_date"), "date", "entry"), (T("pay_amount"), "amount", "entry"),
                  (T("pay_method"), "payment_method", "combo", payment_method_opts()), (T("pay_note"), "notes", "entry")]
        
        for fi in fields:
            row = tk.Frame(fc, bg=COLOR_CARD); row.pack(fill="x", pady=2)
            make_label(row, fi[0], font=FONT_BOLD).pack(side="right")
            v = tk.StringVar(); self.vars[fi[1]] = v
            if fi[2] == "combo":
                w = make_combo(row, v, fi[3], width=15)
                w.set(PAYMENT_METHOD_OPTIONS[0])
            else:
                w = make_entry(row, v, width=15)
            w.pack(side="left", fill="x", expand=True, padx=(5, 0), ipady=2)
            
        self.vars["date"].set(str(date.today()))
        
        bf = tk.Frame(fc, bg=COLOR_CARD); bf.pack(fill="x", pady=(10, 0))
        
        row1 = tk.Frame(bf, bg=COLOR_CARD); row1.pack(fill="x")
        _can_pay = UserDB.has_perm(CURRENT_USER, "add_payments")
        if _can_pay:
            ModernButton(row1, T("pay_add_btn"), self._add, icon="💾", color=COLOR_SUCCESS).pack(side="right", fill="x", expand=True, padx=(0, 2), ipady=2)
            ModernButton(row1, T("pay_refund"), self._refund, icon="↩️", color=COLOR_WARNING).pack(side="left", fill="x", expand=True, padx=(2, 0), ipady=2)
        else:
            tk.Label(row1, text=T("pay_readonly"),
                     font=FONT_SMALL, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT,
                     anchor=A()).pack(fill="x", pady=4)
        
        ModernButton(bf, T("pay_print"), self._print_receipt, icon="🖨️", color=COLOR_PURPLE).pack(fill="x", pady=(4, 0), ipady=2)

        # يسار: البحث + قائمة المترشحين
        left = tk.Frame(main_container, bg=COLOR_BG)
        left.pack(side="left", fill="both", expand=True)

        # بحث + مترشحين في نفس البطاقة لتوفير المساحة
        co, cc = make_card(left, padding=5); co.pack(fill="both", expand=True, pady=(0, 10))
        
        sc = tk.Frame(cc, bg=COLOR_CARD); sc.pack(fill="x", pady=(0, 5))
        tk.Label(sc, text=T("pay_search_lbl"), font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_TEXT).pack(side=S(), padx=5)
        self.search_var = tk.StringVar()
        self.search_var.trace("w", lambda *a: self._load_candidates())
        make_entry(sc, self.search_var, width=25).pack(side="right", fill="x", expand=True, ipady=3, padx=5)

        self.cand_tree = create_treeview(cc,
            ("id","last_name","first_name","phone","total_amount"),
            (T("pay_col_id"), T("pay_col_last"), T("pay_col_first"),
             T("pay_col_phone2"), T("pay_col_total")),
            (50,140,140,120,140), height=12)
        self.cand_tree.bind("<<TreeviewSelect>>", self._on_candidate_select)

    def _load_candidates(self):
        rows = CandidateDB.get_all(self.search_var.get())
        values = [(r['id'], r['last_name'], r['first_name'], r['phone'],
                   f"{r['total_amount']:,.0f} {T('currency_unit')}") for r in rows]
        insert_zebra(self.cand_tree, values)

    def _on_candidate_select(self, event):
        sel = self.cand_tree.selection()
        if not sel: return
        self.selected_candidate_id = self.cand_tree.item(sel[0])['values'][0]
        self._refresh_candidate_ui()

    def _refresh_candidate_ui(self):
        cand = CandidateDB.get(self.selected_candidate_id)
        total = cand['total_amount'] if cand else 0
        paid = PaymentDB.get_total_by_candidate(self.selected_candidate_id) if cand else 0
        rem = total - paid
        cur = T("currency_unit")
        self.lbl_total.config(text=f"{T('pay_lbl_total')} {total:,.0f} {cur}")
        self.lbl_paid.config(text=f"{T('pay_lbl_paid')} {paid:,.0f} {cur}")
        self.lbl_remaining.config(
            text=f"{T('pay_lbl_remaining')} {rem:,.0f} {cur}",
            fg=COLOR_ACCENT if rem > 0 else "#a7f3d0")
        self._load_payments()

    def _load_payments(self):
        if not hasattr(self, 'pay_tree') or not self.pay_tree.winfo_exists():
            return
        if not self.selected_candidate_id:
            insert_zebra(self.pay_tree, []); return
        rows = PaymentDB.get_by_candidate(self.selected_candidate_id)
        values = [(p['id'], p['date'], f"{p['amount']:,.0f}",
                   p['payment_method'], p['notes']) for p in rows]
        insert_zebra(self.pay_tree, values)

    def _show_history_window(self):
        if not self.selected_candidate_id: return
        win = tk.Toplevel(self)
        cand = CandidateDB.get(self.selected_candidate_id)
        name = f"{cand['first_name']} {cand['last_name']}" if cand else ""
        win.title(f"{T('pay_history_title')} - {name}")
        win.geometry("850x450")
        win.configure(bg=COLOR_BG)
        win.transient(self.winfo_toplevel())
        
        lbl = tk.Label(win, text=f"{T('pay_history_for')} {name}", font=(FONT_FAMILY, 16, "bold"), bg=COLOR_BG, fg=COLOR_HEADER)
        lbl.pack(pady=15)
        
        self.pay_tree = create_treeview(win,
            ("id","date","amount","payment_method","notes"),
            (T("pay_col_num"),T("pay_col_date2"),T("pay_col_amount_da"),T("pay_col_method2"),T("pay_col_note2")),
            (50,120,130,140,250), height=12)
        self.pay_tree.bind("<<TreeviewSelect>>", self._on_payment_select)
        
        self._load_payments()
        
        bf = tk.Frame(win, bg=COLOR_BG)
        bf.pack(fill="x", pady=15, padx=20)
        ModernButton(bf, T("pay_btn_del"), self._delete, icon="🗑️", color=COLOR_DANGER).pack(side=So())
        ModernButton(bf, T("pay_btn_close"), win.destroy, color=COLOR_TEXT_LIGHT).pack(side=S())

    def _on_payment_select(self, event):
        sel = self.pay_tree.selection()
        if sel:
            self.selected_payment_id = self.pay_tree.item(sel[0])['values'][0]

    def _add(self):
        if not self.selected_candidate_id:
            show_error(T("cand_sel_first")); return
        try:
            amt_str = self.vars["amount"].get().replace(",", ".").replace(" ", "")
            amt = float(amt_str or 0)
            if amt <= 0:
                show_error(T("pay_err_amount")); return
        except ValueError:
            show_error(T("pay_err_amount_num")); return
        PaymentDB.add({"candidate_id": self.selected_candidate_id,
                       "date": self.vars["date"].get().strip() or str(date.today()),
                       "amount": amt,
                       "payment_method": to_ar_pay_mth(self.vars["payment_method"].get()) or "نقدي",
                       "notes": self.vars["notes"].get().strip()})
        self.vars["amount"].set(""); self.vars["notes"].set("")
        self._refresh_candidate_ui()
        
        if messagebox.askyesno(T("msg_success"), T("pay_added_print_q")):
            self._print_receipt()

    def _print_receipt(self):
        if not self.selected_candidate_id:
            show_error(T("cand_sel_first")); return

        cand = CandidateDB.get(self.selected_candidate_id)
        if not cand: return

        school = SchoolInfoDB.get()
        payments = PaymentDB.get_by_candidate(cand['id'])
        total_paid = sum(p['amount'] for p in payments)
        rem = cand['total_amount'] - total_paid

        default_name = (f"recu_paiement_{cand.get('last_name','')}.html" if LANG == "fr"
                        else f"وصل_دفع_{cand.get('last_name','')}.html")
        import os, tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/receipt_{int(_dtt.now().timestamp())}.html"

        # إنشاء صفحة HTML للوصل لكي تفتح في المتصفح وتطبع تلقائياً
        school_name = school.get('name', 'مدرسة تعليم السياقة')
        school_address = school.get('address', '')
        school_phone = school.get('phone', '')
        cand_name = f"{cand.get('last_name','')} {cand.get('first_name','')}"
        cand_phone = cand.get('phone', '')
        
        rows_html = ""
        for i, p in enumerate(payments, 1):
            notes = p.get('notes', '') or '-'
            method = p.get('payment_method', '')
            amt = f"{p['amount']:,.0f}"
            date_str = p.get('date', '')
            rows_html += f"<tr><td>{i}</td><td>{date_str}</td><td>{amt}</td><td>{method}</td><td>{notes}</td></tr>"

        _dir  = "rtl" if LANG == "ar" else "ltr"
        _lang = LANG
        _cur  = T("currency_unit")
        _rcp  = T("receipt_title")
        _addr_lbl = T("receipt_address_lbl")
        _ph_lbl   = T("receipt_phone_lbl")
        _cand_lbl = T("receipt_cand_lbl")
        _phone_lbl= T("receipt_cand_phone")
        _col_num  = T("receipt_col_num")
        _col_date = T("receipt_col_date")
        _col_amt  = f"{T('receipt_col_amount')} ({_cur})"
        _col_mth  = T("receipt_col_method")
        _col_note = T("receipt_col_note")
        _sum_total= T("receipt_sum_total")
        _sum_paid = T("receipt_sum_paid")
        _sum_rem  = T("receipt_sum_remaining")
        _issued   = T("receipt_issued")
        _sign     = T("receipt_signature")
        html_content = f"""
        <!DOCTYPE html>
        <html dir="{_dir}" lang="{_lang}">
        <head>
            <meta charset="UTF-8">
            <title>{_rcp} - {cand_name}</title>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 30px; font-size: 15px; color: #111; }}
                .header {{ text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 30px; }}
                .header h1 {{ margin: 0 0 10px 0; color: #1e3a8a; font-size: 26px; }}
                .header p {{ margin: 5px 0; font-size: 14px; color: #444; }}
                .title {{ text-align: center; font-size: 22px; font-weight: bold; margin: 20px 0; border: 1px solid #ccc; display: inline-block; padding: 10px 40px; border-radius: 5px; background: #f8fafc; }}
                .center-title {{ text-align: center; }}
                .info {{ margin-bottom: 30px; font-size: 16px; }}
                .info p {{ margin: 8px 0; }}
                table {{ width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 15px; }}
                th, td {{ border: 1px solid #cbd5e1; padding: 12px 8px; text-align: center; }}
                th {{ background-color: #2563eb; color: white; font-weight: bold; }}
                tr:nth-child(even) {{ background-color: #f8fafc; }}
                .summary-container {{ display: flex; justify-content: flex-end; }}
                .summary {{ width: 50%; }}
                .summary th {{ background-color: #f1f5f9; color: #111; text-align: right; padding-right: 15px; }}
                .summary td {{ font-weight: bold; font-size: 16px; }}
                .footer {{ margin-top: 50px; text-align: left; padding-left: 10%; font-size: 16px; }}
                .footer p {{ margin: 10px 0; }}
                @media print {{
                    @page {{ margin: 1cm; }}
                    body {{ padding: 0; }}
                    .title {{ border: 1px solid #000; }}
                    th {{ background-color: #ddd !important; color: #000 !important; -webkit-print-color-adjust: exact; }}
                    tr:nth-child(even) {{ background-color: #f9f9f9 !important; -webkit-print-color-adjust: exact; }}
                }}
            </style>
        </head>
        <body onload="setTimeout(function(){{ window.print(); }}, 500);">
            <div class="header">
                <h1>{school_name}</h1>
                <p>{_addr_lbl}: {school_address} | {_ph_lbl}: {school_phone}</p>
            </div>
            
            <div class="center-title">
                <div class="title">{_rcp}</div>
            </div>
            
            <div class="info">
                <p><strong>{_cand_lbl}:</strong> {cand_name}</p>
                <p><strong>{_phone_lbl}:</strong> {cand_phone}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>{_col_num}</th>
                        <th>{_col_date}</th>
                        <th>{_col_amt}</th>
                        <th>{_col_mth}</th>
                        <th>{_col_note}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
            
            <div class="summary-container">
                <table class="summary">
                    <tr><th>{_sum_total}</th><td>{cand['total_amount']:,.0f} {_cur}</td></tr>
                    <tr><th>{_sum_paid}</th><td>{total_paid:,.0f} {_cur}</td></tr>
                    <tr><th>{_sum_rem}</th><td>{rem:,.0f} {_cur}</td></tr>
                </table>
            </div>
            
            <div class="footer">
                <p>{_issued}: {date.today().strftime('%Y-%m-%d')}</p>
                <br>
                <p>{_sign}: ............................</p>
            </div>
        </body>
        </html>
        """
        
        try:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            try:
                os.startfile(path, 'print')
            except Exception:
                os.startfile(path)
            import shutil
            if messagebox.askyesno(T("msg_save_copy_title") if "msg_save_copy_title" in _TRANSLATIONS.get(LANG,{}) else "حفظ",
                                   T("msg_save_copy_q") if "msg_save_copy_q" in _TRANSLATIONS.get(LANG,{}) else "هل تريد حفظ نسخة من الوصل؟"):
                sp = filedialog.asksaveasfilename(
                    defaultextension=".html",
                    filetypes=[("HTML Files", "*.html"), ("All Files", "*.*")],
                    initialfile=default_name)
                if sp:
                    try: shutil.copy2(path, sp)
                    except Exception: pass
        except Exception as e:
            show_error(f"{T('pay_err_print')}\n{e}")

    def _refund(self):
        if not self.selected_candidate_id:
            show_error(T("cand_sel_first")); return
        try:
            amt_str = self.vars["amount"].get().replace(",", ".").replace(" ", "")
            amt = float(amt_str or 0)
            if amt <= 0:
                show_error(T("pay_err_amount")); return
        except ValueError:
            show_error(T("pay_err_amount_num")); return
        notes = self.vars["notes"].get().strip()
        notes = f"{T('pay_refund_note')}: {notes}" if notes else T("pay_refund_note")
        PaymentDB.add({"candidate_id": self.selected_candidate_id,
                       "date": self.vars["date"].get().strip() or str(date.today()),
                       "amount": -amt,
                       "payment_method": to_ar_pay_mth(self.vars["payment_method"].get()) or "نقدي",
                       "notes": notes})
        self.vars["amount"].set(""); self.vars["notes"].set("")
        self._refresh_candidate_ui()
        show_info(T("pay_refunded"))

    def _delete(self):
        if not self.selected_payment_id:
            show_error(T("pay_sel_first")); return
        if confirm_delete(T("pay_del_confirm")):
            PaymentDB.delete(self.selected_payment_id)
            self.selected_payment_id = None
            self._refresh_candidate_ui()
            show_info(T("pay_deleted"))


# ============================================================================
#  واجهة: المصاريف
# ============================================================================

class ExpensesFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.selected_id = None
        self.vars = {}
        self._build(); self._load_list()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=15)
        wrap.pack(fill="both", expand=True)
        tk.Label(wrap, text=T("exp_title"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(fill="x", pady=(0, 5))
        tk.Label(wrap, text=T("exp_subtitle"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT,
                 anchor=A()).pack(fill="x", pady=(0, 15))

        bottom = tk.Frame(wrap, bg=COLOR_BG); bottom.pack(fill="both", expand=True)

        # يمين: نموذج
        right = tk.Frame(bottom, bg=COLOR_BG, width=340); right.pack(side="right", fill="y")
        right.pack_propagate(False)
        fo, fc = make_card(right); fo.pack(fill="both", expand=True, padx=(10, 0))
        section_title(fc, T("exp_form"), icon="💸")

        fields = [(T("exp_type"), "expense_type", "combo", EXPENSE_TYPES),
                  (T("exp_amount"), "amount", "entry"),
                  (T("exp_date"), "date", "entry"),
                  (T("exp_note"), "notes", "entry")]
        for fi in fields:
            row = tk.Frame(fc, bg=COLOR_CARD); row.pack(fill="x", pady=8)
            make_label(row, fi[0], font=FONT_BOLD).pack(anchor=A())
            v = tk.StringVar(); self.vars[fi[1]] = v
            if fi[2] == "combo":
                w = make_combo(row, v, fi[3], width=22, state="normal")
            else:
                w = make_entry(row, v, width=24)
            w.pack(fill="x", ipady=5, pady=(3, 0))
        self.vars["date"].set(str(date.today()))

        bf = tk.Frame(fc, bg=COLOR_CARD); bf.pack(fill="x", pady=(15, 0))
        ModernButton(bf, T("btn_add"), self._add, icon="➕",
                     color=COLOR_SUCCESS).pack(fill="x", pady=3)
        ModernButton(bf, T("btn_edit"), self._update, icon="✏️",
                     color=COLOR_PRIMARY).pack(fill="x", pady=3)
        ModernButton(bf, T("btn_delete"), self._delete, icon="🗑️",
                     color=COLOR_DANGER).pack(fill="x", pady=3)
        ModernButton(bf, T("btn_clear"), self._clear, icon="🔄",
                     color=COLOR_TEXT_LIGHT).pack(fill="x", pady=3)

        # يسار: جدول
        lo, lc = make_card(bottom, padding=10); lo.pack(side="left", fill="both",
                                                        expand=True, padx=(0, 10))
        sb_outer, sb = make_card(lc, padding=10); sb_outer.pack(fill="x", pady=(0, 5))
        tk.Label(sb, text="🔍", font=(FONT_FAMILY, 14),
                 bg=COLOR_CARD, fg=COLOR_PRIMARY).pack(side="right", padx=(0, 8))
        self.search_var = tk.StringVar()
        self.search_var.trace("w", lambda *a: self._load_list())
        make_entry(sb, self.search_var, width=30).pack(side="right", fill="x",
                                                       expand=True, ipady=5)
        tk.Label(sb, text=T("exp_search"), font=FONT_BOLD, bg=COLOR_CARD,
                 fg=COLOR_TEXT, anchor=A()).pack(side="right", padx=10)

        self.tree = create_treeview(lc,
            ("id","expense_type","amount","date","notes"),
            (T("exp_col_num"),T("exp_col_type"),T("exp_col_amount"),T("exp_col_date"),T("exp_col_note")),
            (50,180,140,130,260), height=15)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

    def _load_list(self):
        rows = ExpenseDB.get_all(self.search_var.get())
        values = [(r['id'], r['expense_type'], f"{r['amount']:,.0f}",
                   r['date'], r['notes']) for r in rows]
        insert_zebra(self.tree, values)

    def _on_select(self, event):
        sel = self.tree.selection()
        if not sel: return
        rid = self.tree.item(sel[0])['values'][0]
        self.selected_id = rid
        for r in ExpenseDB.get_all():
            if r['id'] == rid:
                self.vars["expense_type"].set(r['expense_type'])
                self.vars["amount"].set(str(r['amount']))
                self.vars["date"].set(r['date'])
                self.vars["notes"].set(r['notes'])
                break

    def _data(self):
        try: amt = float(self.vars["amount"].get() or 0)
        except ValueError: amt = 0
        return {"expense_type": self.vars["expense_type"].get().strip(),
                "amount": amt,
                "date": self.vars["date"].get().strip() or str(date.today()),
                "notes": self.vars["notes"].get().strip()}

    def _add(self):
        d = self._data()
        if not d["expense_type"]:
            show_error(T("exp_err_type")); return
        if d["amount"] <= 0:
            show_error(T("exp_err_amount")); return
        ExpenseDB.add(d); self._clear(); self._load_list()
        show_info(T("exp_added"))

    def _update(self):
        if not self.selected_id:
            show_error(T("exp_sel_first")); return
        d = self._data()
        if not d["expense_type"]:
            show_error(T("exp_err_type")); return
        if d["amount"] <= 0:
            show_error(T("exp_err_amount")); return
        ExpenseDB.update(self.selected_id, d)
        self._load_list()
        show_info(T("exp_updated"))

    def _delete(self):
        if not self.selected_id:
            show_error(T("exp_sel_first")); return
        if confirm_delete(T("exp_del_confirm")):
            ExpenseDB.delete(self.selected_id)
            self._clear(); self._load_list()
            show_info(T("exp_deleted"))

    def _clear(self):
        self.selected_id = None
        for v in self.vars.values(): v.set("")
        self.vars["date"].set(str(date.today()))


# ============================================================================
#  واجهة: التقارير
# ============================================================================

class ReportsFrame(tk.Frame):
    def __init__(self, parent, navigate_cb=None):
        super().__init__(parent, bg=COLOR_BG)
        self._navigate_cb = navigate_cb
        self._build()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=15)
        wrap.pack(fill="both", expand=True)
        tk.Label(wrap, text=T("rep_title"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(fill="x", pady=(0, 5))
        tk.Label(wrap, text=T("rep_subtitle"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT,
                 anchor=A()).pack(fill="x", pady=(0, 15))

        # شريط الفلتر الزمني
        fo, fc = make_card(wrap, padding=15); fo.pack(fill="x", pady=(0, 15))
        today_str     = date.today().strftime('%Y-%m-%d')
        year_start    = date.today().strftime('%Y') + '-01-01'

        ModernButton(fc, T("btn_apply"), self._refresh, icon="📈",
                     color=COLOR_PRIMARY).pack(side="right", padx=5)
        ModernButton(fc, T("btn_all_periods"), self._reset_filter, icon="🗓️",
                     color=COLOR_TEXT_LIGHT).pack(side="right", padx=5)

        tk.Label(fc, text=T("rep_to"), font=FONT_BOLD,
                 bg=COLOR_CARD, fg=COLOR_TEXT, anchor=A()).pack(side="right", padx=(15, 3))
        self.date_to_var = tk.StringVar(value=today_str)
        make_entry(fc, self.date_to_var, width=13).pack(side="right", padx=3, ipady=4)

        tk.Label(fc, text=T("rep_from"), font=FONT_BOLD,
                 bg=COLOR_CARD, fg=COLOR_TEXT, anchor=A()).pack(side="right", padx=(15, 3))
        self.date_from_var = tk.StringVar(value=year_start)
        make_entry(fc, self.date_from_var, width=13).pack(side="right", padx=3, ipady=4)

        tk.Label(fc, text=T("rep_filter_lbl"),
                 font=FONT_SMALL, bg=COLOR_CARD,
                 fg=COLOR_TEXT_LIGHT, anchor=A()).pack(side="right", padx=10)

        # بطاقات إحصائية
        self.stats_row = tk.Frame(wrap, bg=COLOR_BG); self.stats_row.pack(fill="x", pady=(0, 15))

        # تفصيل شهري
        mo, mc = make_card(wrap, padding=10); mo.pack(fill="x", pady=(0, 12))
        section_title(mc, T("rep_monthly"), icon="📅")
        self.monthly_tree = create_treeview(mc,
            ("month","payments","expenses","profit"),
            (T("rep_col_month"),T("rep_col_pay"),T("rep_col_exp"),T("rep_col_profit")),
            (140,180,180,180), height=8)

        # إحصائيات الامتحانات
        eo, ec = make_card(wrap, padding=10); eo.pack(fill="both", expand=True)
        section_title(ec, T("rep_exam_stats"), icon="🎓")
        self._exam_stats_row = tk.Frame(ec, bg=COLOR_CARD)
        self._exam_stats_row.pack(fill="x", pady=(0, 8))

        # -- مخطط شريطي شهري --
        chart_lbl = tk.Label(ec,
            text=T("rep_chart_lbl"),
            font=FONT_SMALL, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT, anchor=A())
        chart_lbl.pack(anchor=A(), pady=(0, 4))
        self._exam_chart = tk.Canvas(ec, bg=COLOR_CARD, height=160,
                                     highlightthickness=0)
        self._exam_chart.pack(fill="x", padx=4, pady=(0, 8))

        # -- جدول تفصيلي --
        self._exam_monthly_tree = create_treeview(ec,
            ("month", "nazari_total", "nazari_pass", "tatbiqi_total", "tatbiqi_pass"),
            (T("rep_col_month"),T("rep_col_nazari_t"),T("rep_col_nazari_p"),T("rep_col_tatbiqi_t"),T("rep_col_tatbiqi_p")),
            (120, 140, 120, 160, 130), height=5)

        self._refresh()

    def _reset_filter(self):
        """يمسح الفلتر الزمني ويعيد تحميل كل البيانات."""
        self.date_from_var.set("")
        self.date_to_var.set("")
        self._refresh()

    def _refresh(self):
        d_from = self.date_from_var.get().strip()
        d_to   = self.date_to_var.get().strip()

        # التحقق من صحة تنسيق التاريخ
        def valid_date(s):
            if not s:
                return True
            try:
                datetime.strptime(s, '%Y-%m-%d')
                return True
            except ValueError:
                return False

        if not valid_date(d_from):
            messagebox.showerror(T("msg_error"), T("period_bad_from"))
            return
        if not valid_date(d_to):
            messagebox.showerror(T("msg_error"), T("period_bad_to"))
            return

        # إجمالي المدفوعات والمصاريف في الفترة
        tp   = PaymentDB.get_total_in_range(d_from, d_to)
        te   = ExpenseDB.get_total_in_range(d_from, d_to)
        prof = tp - te
        nc   = len(CandidateDB.get_all())
        ni   = len(InstructorDB.get_all())

        # إعادة بناء البطاقات
        for w in self.stats_row.winfo_children():
            w.destroy()
        nav     = self._navigate_cb
        go_pay  = (lambda: nav(6)) if nav else None
        go_exp  = (lambda: nav(7)) if nav else None
        go_rep  = (lambda: nav(8)) if nav else None

        stat_card(self.stats_row, T("rep_total_pay"), f"{tp:,.0f}",   "💰",
                  COLOR_SUCCESS, command=go_pay)
        stat_card(self.stats_row, T("rep_total_exp"),  f"{te:,.0f}",   "💸",
                  COLOR_DANGER,  command=go_exp)
        stat_card(self.stats_row, T("rep_net_profit"),     f"{prof:,.0f}", "💎",
                  COLOR_PRIMARY if prof >= 0 else COLOR_DANGER, command=go_rep)
        stat_card(self.stats_row, T("rep_period_cand"),
                  str(CandidateDB.count_in_range(d_from, d_to)), "👥", COLOR_INFO)
        stat_card(self.stats_row, T("dash_instructors"),  str(ni), "🚗", COLOR_PURPLE)

        # ── التفصيل الشهري للفترة المحددة ────────────────────────────────
        ap = {r['month']: r['total'] for r in PaymentDB.get_monthly_breakdown_range(d_from, d_to)}
        ae = {r['month']: r['total'] for r in ExpenseDB.get_monthly_breakdown_range(d_from, d_to)}
        all_months = sorted(set(ap.keys()) | set(ae.keys()))

        rows = []
        for ym in all_months:
            p = ap.get(ym, 0); e = ae.get(ym, 0)
            parts = ym.split('-')
            month_lbl = (MONTHS_FR if LANG == "fr" else MONTHS_AR).get(parts[1], parts[1]) + '  ' + parts[0]
            rows.append((month_lbl, f"{p:,.0f}", f"{e:,.0f}", f"{p - e:,.0f}"))
        if not rows:
            rows = [(T("rep_no_data"), "—", "—", "—")]
        insert_zebra(self.monthly_tree, rows)

        # نقر مزدوج على صف التفصيل الشهري → ينتقل للمدفوعات
        def _on_month_dbl(e):
            if nav:
                nav(6)
        self.monthly_tree.bind("<Double-Button-1>", _on_month_dbl)
        self.monthly_tree.configure(cursor="hand2")

        # ── إحصائيات الامتحانات ─────────────────────────────────────────
        for w in self._exam_stats_row.winfo_children():
            w.destroy()

        pass_data  = ExamResultDB.get_pass_rate_in_range(d_from, d_to)
        total_all  = sum(r['total']  for r in pass_data)
        passed_all = sum(r['passed'] for r in pass_data)
        overall_pct = int(passed_all / total_all * 100) if total_all else 0

        overall_color = COLOR_SUCCESS if overall_pct >= 50 else (
            COLOR_WARNING if total_all == 0 else COLOR_DANGER)
        stat_card(self._exam_stats_row, T("rep_overall_rate"),
                  f"{overall_pct}%", "🎓", overall_color)

        for r in pass_data:
            total  = r['total']; passed = r['passed']
            pct    = int(passed / total * 100) if total else 0
            color  = COLOR_SUCCESS if pct >= 50 else (
                COLOR_WARNING if total == 0 else COLOR_DANGER)
            stat_card(self._exam_stats_row,
                      f"{T('rep_pass_rate_of')} {r['exam_type']}",
                      f"{pct}%  ({passed}/{total})",
                      "📝", color)

        # جدول التفصيل الشهري للامتحانات
        monthly_exam = ExamResultDB.get_monthly_breakdown_range(d_from, d_to)
        em = {}
        for r in monthly_exam:
            mo_ = r['month']
            em.setdefault(mo_, {})
            em[mo_][r['exam_type']] = {"total": r['total'], "passed": r['passed']}

        all_exam_months = sorted(em.keys())
        exam_rows = []
        for ym in all_exam_months:
            parts     = ym.split('-')
            month_lbl = (MONTHS_FR if LANG == "fr" else MONTHS_AR).get(parts[1], parts[1]) + '  ' + parts[0]
            naz = em[ym].get("نظري",   {"total": 0, "passed": 0})
            tat = em[ym].get("تطبيقي", {"total": 0, "passed": 0})
            exam_rows.append((
                month_lbl,
                str(naz['total'])  if naz['total']  else "—",
                str(naz['passed']) if naz['total']  else "—",
                str(tat['total'])  if tat['total']  else "—",
                str(tat['passed']) if tat['total']  else "—",
            ))
        if not exam_rows:
            exam_rows = [(T("report_no_data"), "—", "—", "—", "—")]
        insert_zebra(self._exam_monthly_tree, exam_rows)

        # ── رسم المخطط الشريطي (كل الفترة المختارة) ─────────────────────
        self._draw_exam_bar_chart(em)

    def _draw_exam_bar_chart(self, em):
        """يرسم مخططاً شريطياً على Canvas لكل الأشهر (YYYY-MM) في الفترة المختارة."""
        canvas = self._exam_chart
        canvas.delete("all")
        canvas.update_idletasks()

        W = canvas.winfo_width() or 700
        H = 160
        pad_l, pad_r, pad_top, pad_bot = 32, 10, 14, 28

        # ترتيب الأشهر YYYY-MM من البيانات (ديناميكي حسب الفترة)
        sorted_keys = sorted(em.keys())

        if not sorted_keys:
            canvas.create_text(W // 2, H // 2,
                               text=T("report_no_data"),
                               font=FONT_SMALL, fill=COLOR_TEXT_LIGHT)
            canvas.bind("<Configure>", lambda e: self._draw_exam_bar_chart(em))
            return

        # بناء قائمة البيانات
        data = []
        for ym in sorted_keys:
            naz = em[ym].get("نظري",   {"total": 0, "passed": 0})
            tat = em[ym].get("تطبيقي", {"total": 0, "passed": 0})
            data.append((naz['total'], naz['passed'], tat['total'], tat['passed']))

        n = len(data)
        max_val = max((max(d) for d in data), default=1) or 1
        chart_h = H - pad_top - pad_bot
        chart_w = W - pad_l - pad_r
        group_w = chart_w / n
        bar_w   = max(2, int(group_w / 3) - 1)

        base_y = H - pad_bot
        canvas.create_line(pad_l, pad_top, pad_l, base_y,
                           fill=COLOR_BORDER, width=1)
        canvas.create_line(pad_l, base_y, W - pad_r, base_y,
                           fill=COLOR_BORDER, width=1)

        for fraction in (0.25, 0.5, 0.75, 1.0):
            gy = base_y - int(chart_h * fraction)
            canvas.create_line(pad_l, gy, W - pad_r, gy,
                               fill="#e2e8f0", dash=(4, 4))
            canvas.create_text(pad_l - 4, gy, text=str(int(max_val * fraction)),
                               font=(FONT_FAMILY, 7), fill=COLOR_TEXT_LIGHT, anchor=A())

        BLUE  = COLOR_PRIMARY
        GREEN = COLOR_SUCCESS
        GRAY  = "#CBD5E1"

        for i, ((naz_tot, naz_pass, tat_tot, tat_pass), ym) in enumerate(zip(data, sorted_keys)):
            cx = pad_l + i * group_w + group_w / 2

            def bar(value, color, offset, _cx=cx):
                if value <= 0:
                    return
                bh = max(2, int(chart_h * value / max_val))
                x0 = int(_cx + offset - bar_w / 2)
                canvas.create_rectangle(x0, base_y - bh, x0 + bar_w, base_y,
                                        fill=color, outline="", width=0)

            bar(naz_tot,  GRAY,  -bar_w - 1)
            bar(naz_pass, BLUE,  -bar_w - 1)
            bar(tat_tot,  GRAY,   bar_w + 1)
            bar(tat_pass, GREEN,  bar_w + 1)

            # ملصق YYYY-MM مختصر (MM فقط إذا كانت سنة واحدة، وإلا MM/YY)
            parts = ym.split('-')
            lbl = (MONTHS_FR if LANG == "fr" else MONTHS_AR).get(parts[1], parts[1])[:3]
            if n > 12:
                lbl = parts[1] + "/" + parts[0][2:]
            canvas.create_text(int(cx), base_y + 4, text=lbl,
                               font=(FONT_FAMILY, 7), fill=COLOR_TEXT_LIGHT, anchor="n")

        canvas.bind("<Configure>", lambda e: self._draw_exam_bar_chart(em))


# ============================================================================
#  واجهة: الوثائق (طباعة PDF بالعربية)
# ============================================================================

def _pdf_styles():
    """يبني أنماط فقرات تدعم العربية والفرنسية."""
    base = ParagraphStyle('base', fontName=ARABIC_FONT, fontSize=11, leading=18)
    body_align = TA_LEFT if LANG == "fr" else TA_RIGHT
    return {
        "title":  ParagraphStyle('title',  parent=base, fontName=ARABIC_FONT_BOLD,
                                  fontSize=16, alignment=TA_CENTER, leading=22),
        "h2":     ParagraphStyle('h2',     parent=base, fontName=ARABIC_FONT_BOLD,
                                  fontSize=13, alignment=body_align, leading=20),
        "right":  ParagraphStyle('right',  parent=base, alignment=body_align, leading=20),
        "center": ParagraphStyle('center', parent=base, alignment=TA_CENTER, leading=20),
        "small_right": ParagraphStyle('sr', parent=base, alignment=body_align,
                                       fontSize=10, leading=14),
    }


def _pdf_header(story, school, title):
    s = _pdf_styles()
    if LANG == "fr":
        story.append(Paragraph("République Algérienne Démocratique et Populaire", s["small_right"]))
        if school.get('name'):
            story.append(Paragraph(school['name'], s["h2"]))
        info_line = []
        if school.get('phone'):   info_line.append(f"Tél: {school['phone']}")
        if school.get('address'): info_line.append(f"Adresse: {school['address']}")
        if info_line:
            story.append(Paragraph(" | ".join(info_line), s["small_right"]))
        if school.get('accreditation_number'):
            story.append(Paragraph(f"N° Agrément: {school['accreditation_number']}",
                                   s["small_right"]))
        if school.get('manager_name'):
            story.append(Paragraph(f"Responsable : {school['manager_name']}",
                                   s["small_right"]))
    else:
        story.append(Paragraph(ar("الجمهورية الجزائرية الديمقراطية الشعبية"), s["small_right"]))
        if school.get('name'):
            story.append(Paragraph(ar(school['name']), s["h2"]))
        info_line = []
        if school.get('phone'):    info_line.append(f"الهاتف: {school['phone']}")
        if school.get('address'):  info_line.append(f"العنوان: {school['address']}")
        if info_line:
            story.append(Paragraph(ar(" | ".join(info_line)), s["small_right"]))
        if school.get('accreditation_number'):
            story.append(Paragraph(ar(f"رقم الاعتماد: {school['accreditation_number']}"),
                                   s["small_right"]))
        if school.get('manager_name'):
            story.append(Paragraph(ar(f"المسيّر: {school['manager_name']}"),
                                   s["small_right"]))
    story.append(Spacer(1, 0.4*cm))
    line_table = Table([[""]], colWidths=[17*cm])
    line_table.setStyle(TableStyle([('LINEBELOW', (0,0), (-1,-1), 1.2, colors.HexColor('#2563eb'))]))
    story.append(line_table)
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(_ptxt(title), s["title"]))
    story.append(Spacer(1, 0.6*cm))


def _styled_table(data_rows, col_widths):
    """يصنع جدولاً منسقاً بنصوص معالجة (عربية أو فرنسية)."""
    processed = [[_ptxt(c) for c in row] for row in data_rows]
    t = Table(processed, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), ARABIC_FONT),
        ('FONTNAME', (0,0), (-1,0),  ARABIC_FONT_BOLD),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2563eb')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1),
            [colors.white, colors.HexColor('#f1f5f9')]),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ]))
    return t


def _ar_lic_code(lic):
    """يُعيد الكود الرسمي للصنف كما يُكتب في جدول الارسال الجزائري."""
    return {"A1": "أ1/", "A": "أ/", "B": "ب",
            "C1": "ج1", "C": "ج", "D": "د",
            "E": "هـ", "F": "و"}.get(lic, lic)


def _strip_wilaya_num(w):
    """يُزيل بادئة الرقم من اسم الولاية: '02 - الشلف' → 'الشلف'."""
    import re as _re
    return _re.sub(r'^\d+\s*-\s*', '', (w or '').strip())


# ============================================================================
#  نافذة إضافة / تعديل حصة تدريبية
# ============================================================================

class SessionDialog(tk.Toplevel):
    """نافذة Toplevel لإدخال بيانات حصة مع فحص تعارض الممرّن والمركبة."""

    def __init__(self, parent, session_id=None, on_save=None):
        super().__init__(parent)
        self.session_id = session_id
        self.on_save    = on_save
        self.title(T("sched_edit_title") if session_id else T("sched_add_title"))
        self.geometry("580x600")
        self.minsize(580, 600)
        self.resizable(True, True)
        self.grab_set()
        self.configure(bg=COLOR_BG)
        self._vars     = {}
        self._cand_map = {}   # display_name -> id
        self._inst_map = {}   # display_name -> id
        self._veh_map  = {}   # display_name -> id  (None = بدون مركبة)
        self._build()
        if session_id:
            self._load()

    # ──────────────────────────────────────────────────────────
    def _build(self):
        hdr = tk.Frame(self, bg=COLOR_PRIMARY, padx=16, pady=12)
        hdr.pack(fill="x")
        icon = "✏️" if self.session_id else "➕"
        tk.Label(hdr,
                 text=f"{icon}  {T('sched_edit_title') if self.session_id else T('sched_add_title')}",
                 font=(FONT_FAMILY, 14, "bold"), bg=COLOR_PRIMARY, fg="white").pack(anchor=A())

        wrap = tk.Frame(self, bg=COLOR_BG, padx=24, pady=14)
        wrap.pack(fill="both", expand=True)

        cands = CandidateDB.get_all()
        insts = InstructorDB.get_all()
        vehs  = VehicleDB.get_all()

        self._cand_map = {f"{c['last_name']} {c['first_name']}": c['id'] for c in cands}
        self._inst_map = {f"{i['last_name']} {i['first_name']}": i['id'] for i in insts}
        # مركبات: "بلا مركبة" + كل مركبة
        self._veh_map  = {T("sched_no_vehicle"): None}
        for v in vehs:
            label = f"{v['model']} ({v.get('plate_number','') or '—'})"
            self._veh_map[label] = v['id']

        def lbl(text):
            tk.Label(wrap, text=text, font=FONT_BOLD,
                     bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")

        # المترشح
        lbl(T("sched_lbl_cand"))
        self._vars['candidate'] = tk.StringVar()
        ttk.Combobox(wrap, textvariable=self._vars['candidate'],
                     values=list(self._cand_map.keys()),
                     state="readonly", font=FONT_MAIN,
                     justify=J()).pack(fill="x", ipady=4, pady=(4, 10))

        # صف: الممرّن + المركبة
        im_row = tk.Frame(wrap, bg=COLOR_BG)
        im_row.pack(fill="x", pady=(0, 10))

        inst_col = tk.Frame(im_row, bg=COLOR_BG)
        inst_col.pack(side=S(), fill="both", expand=True, padx=(6, 0))
        tk.Label(inst_col, text=T("sched_lbl_inst"), font=FONT_BOLD,
                 bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")
        self._vars['instructor'] = tk.StringVar()
        ttk.Combobox(inst_col, textvariable=self._vars['instructor'],
                     values=list(self._inst_map.keys()),
                     state="readonly", font=FONT_MAIN,
                     justify=J()).pack(fill="x", ipady=4)

        veh_col = tk.Frame(im_row, bg=COLOR_BG)
        veh_col.pack(side=So(), fill="both", expand=True)
        tk.Label(veh_col, text=T("sched_lbl_vehicle"), font=FONT_BOLD,
                 bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")
        self._vars['vehicle'] = tk.StringVar(value=T("sched_no_vehicle"))
        ttk.Combobox(veh_col, textvariable=self._vars['vehicle'],
                     values=list(self._veh_map.keys()),
                     state="readonly", font=FONT_MAIN,
                     justify=J()).pack(fill="x", ipady=4)

        # صف: التاريخ + الوقت
        dt_row = tk.Frame(wrap, bg=COLOR_BG)
        dt_row.pack(fill="x", pady=(0, 10))

        date_col = tk.Frame(dt_row, bg=COLOR_BG)
        date_col.pack(side=S(), fill="both", expand=True, padx=(6, 0))
        tk.Label(date_col, text=T("sched_lbl_date"), font=FONT_BOLD,
                 bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")
        self._vars['session_date'] = tk.StringVar(value=date.today().strftime('%Y-%m-%d'))
        tk.Entry(date_col, textvariable=self._vars['session_date'],
                 font=FONT_MAIN, justify=J(),
                 relief="solid", bd=1).pack(fill="x", ipady=5)

        time_col = tk.Frame(dt_row, bg=COLOR_BG)
        time_col.pack(side=So(), fill="both", expand=True)
        tk.Label(time_col, text=T("sched_lbl_time"), font=FONT_BOLD,
                 bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")
        self._vars['session_time'] = tk.StringVar(value="08:00")
        ttk.Combobox(time_col, textvariable=self._vars['session_time'],
                     values=TIME_OPTIONS, font=FONT_MAIN,
                     justify=J()).pack(fill="x", ipady=4)

        # صف: المدة + نوع الحصة
        dd_row = tk.Frame(wrap, bg=COLOR_BG)
        dd_row.pack(fill="x", pady=(0, 10))

        dur_col = tk.Frame(dd_row, bg=COLOR_BG)
        dur_col.pack(side=S(), fill="both", expand=True, padx=(6, 0))
        tk.Label(dur_col, text=T("sched_lbl_duration"), font=FONT_BOLD,
                 bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")
        self._vars['duration'] = tk.StringVar(value="60")
        ttk.Combobox(dur_col, textvariable=self._vars['duration'],
                     values=DURATION_OPTIONS, font=FONT_MAIN,
                     justify=J()).pack(fill="x", ipady=4)

        type_col = tk.Frame(dd_row, bg=COLOR_BG)
        type_col.pack(side=So(), fill="both", expand=True)
        tk.Label(type_col, text=T("sched_lbl_type"), font=FONT_BOLD,
                 bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")
        self._vars['session_type'] = tk.StringVar(value=SESSION_TYPE_OPTIONS[0])
        ttk.Combobox(type_col, textvariable=self._vars['session_type'],
                     values=SESSION_TYPE_OPTIONS, state="readonly",
                     font=FONT_MAIN, justify=J()).pack(fill="x", ipady=4)

        # ملاحظات
        lbl(T("sched_lbl_notes"))
        self._notes_txt = tk.Text(wrap, height=3, font=FONT_MAIN,
                                  relief="solid", bd=1)
        self._notes_txt.pack(fill="x", pady=(4, 0))

        # رسالة تعارض
        self._conflict_var = tk.StringVar()
        tk.Label(wrap, textvariable=self._conflict_var,
                 font=FONT_SMALL, bg=COLOR_BG, fg=COLOR_DANGER,
                 anchor=A(), wraplength=540).pack(fill="x", pady=(6, 0))

        # أزرار
        bf = tk.Frame(self, bg=COLOR_BG, padx=24, pady=12)
        bf.pack(fill="x")
        ModernButton(bf, text=T("btn_save"), icon="💾",
                     color=COLOR_SUCCESS, command=self._save).pack(side=S())
        ModernButton(bf, text=T("btn_cancel"), icon="✖",
                     color=COLOR_DANGER, command=self.destroy).pack(side=S(), padx=(0, 8))

    # ──────────────────────────────────────────────────────────
    def _load(self):
        s = SessionDB.get(self.session_id)
        if not s:
            return
        cand = CandidateDB.get(s['candidate_id'])
        if cand:
            self._vars['candidate'].set(f"{cand['last_name']} {cand['first_name']}")
        inst = InstructorDB.get(s['instructor_id'])
        if inst:
            self._vars['instructor'].set(f"{inst['last_name']} {inst['first_name']}")
        # المركبة
        vid = s.get('vehicle_id')
        if vid:
            for label, lid in self._veh_map.items():
                if lid == vid:
                    self._vars['vehicle'].set(label)
                    break
        else:
            self._vars['vehicle'].set(T("sched_no_vehicle"))
        self._vars['session_date'].set(s.get('session_date', ''))
        self._vars['session_time'].set(s.get('session_time', '08:00'))
        self._vars['duration'].set(str(s.get('duration', 60)))
        self._vars['session_type'].set(s.get('session_type', SESSION_TYPE_OPTIONS[0]))
        self._notes_txt.insert("1.0", s.get('notes', ''))

    # ──────────────────────────────────────────────────────────
    def _save(self):
        cand_name = self._vars['candidate'].get().strip()
        inst_name = self._vars['instructor'].get().strip()
        s_date    = self._vars['session_date'].get().strip()
        s_time    = self._vars['session_time'].get().strip()
        duration  = self._vars['duration'].get().strip()
        veh_name  = self._vars['vehicle'].get().strip()

        # ── التحقق من الحقول الإلزامية ──
        if not all([cand_name, inst_name, s_date, s_time, duration]):
            show_error(T("sched_err_required")); return
        if cand_name not in self._cand_map:
            show_error(T("sched_err_cand")); return
        if inst_name not in self._inst_map:
            show_error(T("sched_err_inst")); return

        # ── التحقق من صيغة التاريخ ──
        try:
            datetime.strptime(s_date, '%Y-%m-%d')
        except ValueError:
            show_error(T("err_date_format")); return

        # ── التحقق من صيغة الوقت ──
        try:
            datetime.strptime(s_time, '%H:%M')
        except ValueError:
            show_error(T("sched_err_time")); return

        # ── التحقق من المدة ──
        try:
            dur_int = int(duration)
            if dur_int <= 0 or dur_int > 480:
                raise ValueError
        except ValueError:
            show_error(T("sched_err_duration")); return

        inst_id = self._inst_map[inst_name]
        veh_id  = self._veh_map.get(veh_name)  # None إذا "بلا مركبة"

        # ── فحص تعارض الممرّن والمركبة ──
        inst_conflicts, veh_conflicts = SessionDB.check_conflict(
            inst_id, s_date, s_time, duration,
            vehicle_id=veh_id, exclude_id=self.session_id)

        conflict_msgs = []
        if inst_conflicts:
            c = inst_conflicts[0]
            conflict_msgs.append(
                f"{T('sched_conflict_inst')} {c['session_time']} ({T('sched_conflict_dur')} {c['duration']})")
        if veh_conflicts:
            c = veh_conflicts[0]
            conflict_msgs.append(
                f"{T('sched_conflict_veh')} {c['session_time']} ({T('sched_conflict_dur')} {c['duration']})")

        if conflict_msgs:
            msg = f"⚠️  {T('sched_conflict')}:\n" + "\n".join(conflict_msgs)
            self._conflict_var.set(msg)
            if not messagebox.askyesno(T("sched_conflict"),
                    msg + f"\n{T('sched_conflict_date')} {s_date}.\n{T('sched_conflict_q')}"):
                return
        else:
            self._conflict_var.set("")

        d = {
            'candidate_id':  self._cand_map[cand_name],
            'instructor_id': inst_id,
            'vehicle_id':    veh_id,
            'session_date':  s_date,
            'session_time':  s_time,
            'duration':      dur_int,
            'session_type':  self._vars['session_type'].get(),
            'notes':         self._notes_txt.get("1.0", "end-1c").strip(),
        }
        if self.session_id:
            SessionDB.update(self.session_id, d)
        else:
            SessionDB.add(d)

        if self.on_save:
            self.on_save()
        self.destroy()


# ============================================================================
#  واجهة: الجدول الزمني للحصص
# ============================================================================

class ScheduleFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.selected_id = None
        self._build()
        self._load()

    # ──────────────────────────────────────────────────────────
    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=16)
        wrap.pack(fill="both", expand=True)

        # ── العنوان ──
        tk.Label(wrap, text=T("sched_title"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(fill="x", pady=(0, 4))
        tk.Label(wrap, text=T("sched_subtitle"),
                 font=FONT_MAIN, bg=COLOR_BG,
                 fg=COLOR_TEXT_LIGHT, anchor=A()).pack(fill="x", pady=(0, 14))

        # ── شريط الفلاتر والأزرار ──
        ctl = tk.Frame(wrap, bg=COLOR_BG)
        ctl.pack(fill="x", pady=(0, 10))

        # أزرار (يمين)
        btn_row = tk.Frame(ctl, bg=COLOR_BG)
        btn_row.pack(side=S())
        ModernButton(btn_row, text=T("sched_btn_add"), icon="➕",
                     color=COLOR_SUCCESS,
                     command=self._add).pack(side=S())
        ModernButton(btn_row, text=T("btn_edit"), icon="✏️",
                     color=COLOR_PRIMARY,
                     command=self._edit).pack(side=S(), padx=(0, 6))
        ModernButton(btn_row, text=T("btn_delete"), icon="🗑",
                     color=COLOR_DANGER,
                     command=self._delete).pack(side=S(), padx=(0, 6))

        # فلاتر (يسار)
        filter_row = tk.Frame(ctl, bg=COLOR_BG)
        filter_row.pack(side=So())

        tk.Label(filter_row, text="🔍", font=(FONT_FAMILY, 14),
                 bg=COLOR_BG).pack(side=So(), padx=(0, 4))

        # فلتر التاريخ
        tk.Label(filter_row, text=T("sched_filter_date"), font=FONT_SMALL,
                 bg=COLOR_BG, fg=COLOR_TEXT).pack(side=So())
        self._date_var = tk.StringVar()
        tk.Entry(filter_row, textvariable=self._date_var, width=12,
                 font=FONT_MAIN, relief="solid", bd=1,
                 justify=J()).pack(side=So(), padx=4)

        # فلتر الممرّن
        tk.Label(filter_row, text=T("sched_filter_inst"), font=FONT_SMALL,
                 bg=COLOR_BG, fg=COLOR_TEXT).pack(side=So(), padx=(8, 0))
        self._inst_filter_var = tk.StringVar()
        insts = [T("filter_all")] + [f"{i['last_name']} {i['first_name']}"
                            for i in InstructorDB.get_all()]
        self._inst_combo = ttk.Combobox(filter_row,
                                         textvariable=self._inst_filter_var,
                                         values=insts, state="readonly",
                                         width=14, font=FONT_SMALL)
        self._inst_combo.current(0)
        self._inst_combo.pack(side=So(), padx=4)

        # فلتر المترشح
        tk.Label(filter_row, text=T("sched_filter_cand"), font=FONT_SMALL,
                 bg=COLOR_BG, fg=COLOR_TEXT).pack(side=So(), padx=(8, 0))
        self._cand_filter_var = tk.StringVar()
        cands = [T("filter_all")] + [f"{c['last_name']} {c['first_name']}"
                             for c in CandidateDB.get_all()]
        self._cand_combo = ttk.Combobox(filter_row,
                                         textvariable=self._cand_filter_var,
                                         values=cands, state="readonly",
                                         width=14, font=FONT_SMALL)
        self._cand_combo.current(0)
        self._cand_combo.pack(side=So(), padx=4)

        ModernButton(filter_row, text=T("btn_filter"), icon="🔎",
                     color=COLOR_INFO, size="small",
                     command=self._load).pack(side=So(), padx=4)
        ModernButton(filter_row, text=T("sched_btn_all"), icon="↺",
                     color=COLOR_TEXT_LIGHT, size="small",
                     command=self._reset_filter).pack(side=So())

        # ── ملخص سريع للأسبوع ──
        self._week_lbl = tk.Label(wrap, text="",
                                   font=FONT_SMALL, bg=COLOR_BG,
                                   fg=COLOR_TEXT_LIGHT, anchor=A())
        self._week_lbl.pack(fill="x", pady=(0, 6))

        # ── الجدول ──
        tbl_outer, tbl_body = make_card(wrap)
        tbl_outer.pack(fill="both", expand=True)

        self.tree = create_treeview(tbl_body,
            ("date", "time", "dur", "type", "candidate", "instructor", "notes"),
            (T("sched_col_date"), T("sched_col_time"), T("sched_col_dur"),
             T("sched_col_type"), T("sched_col_cand"), T("sched_col_inst"),
             T("sched_col_notes")),
            (100, 70, 60, 100, 180, 160, 160), height=18)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)
        self.tree.bind("<Double-Button-1>", lambda e: self._edit())

    # ──────────────────────────────────────────────────────────
    def _reset_filter(self):
        self._date_var.set("")
        self._inst_filter_var.set(T("filter_all"))
        self._inst_combo.current(0)
        self._cand_filter_var.set(T("filter_all"))
        self._cand_combo.current(0)
        self._load()

    def _load(self):
        self.selected_id = None
        date_f = self._date_var.get().strip()

        # فلتر الممرّن
        inst_filter_name = self._inst_filter_var.get()
        inst_id = None
        if inst_filter_name and inst_filter_name != T("filter_all"):
            for i in InstructorDB.get_all():
                if f"{i['last_name']} {i['first_name']}" == inst_filter_name:
                    inst_id = i['id']
                    break

        # فلتر المترشح
        cand_filter_name = self._cand_filter_var.get()
        cand_id = None
        if cand_filter_name and cand_filter_name != T("filter_all"):
            for c in CandidateDB.get_all():
                if f"{c['last_name']} {c['first_name']}" == cand_filter_name:
                    cand_id = c['id']
                    break

        sessions = SessionDB.get_all(date_filter=date_f,
                                      instructor_id=inst_id,
                                      candidate_id=cand_id)

        rows = [(s['session_date'], s['session_time'], str(s['duration']),
                 s['session_type'], s['candidate_name'],
                 s['instructor_name'], s.get('notes', ''))
                for s in sessions]
        insert_zebra(self.tree, rows)

        # تلوين حصص اليوم
        today_str = date.today().strftime('%Y-%m-%d')
        for item in self.tree.get_children():
            vals = self.tree.item(item, 'values')
            if vals and vals[0] == today_str:
                self.tree.item(item, tags=("today",))
        self.tree.tag_configure("today", background="#dcfce7",
                                foreground="#166534")

        # ربط session_id بكل صف
        self._id_map = {}
        for item, s in zip(self.tree.get_children(), sessions):
            self._id_map[item] = s['id']

        # ملخص الأسبوع
        week = SessionDB.get_week()
        self._week_lbl.configure(
            text=f"{T('sched_week_summary')} {len(week)}  |  {T('sched_today_summary')} {len(SessionDB.get_today())}"
        )

    def _on_select(self, event=None):
        sel = self.tree.selection()
        self.selected_id = self._id_map.get(sel[0]) if sel else None

    # ──────────────────────────────────────────────────────────
    def _add(self):
        SessionDialog(self, on_save=self._load)

    def _edit(self):
        if not self.selected_id:
            show_error(T("sched_sel_first")); return
        SessionDialog(self, session_id=self.selected_id, on_save=self._load)

    def _delete(self):
        if not self.selected_id:
            show_error(T("sched_sel_first")); return
        s = SessionDB.get(self.selected_id)
        if not s:
            return
        msg = (f"{T('sched_del_q')}\n"
               f"{T('sched_col_date')}: {s['session_date']}  {T('sched_col_time')}: {s['session_time']}\n")
        if messagebox.askyesno(T("msg_confirm_del"), msg):
            SessionDB.delete(self.selected_id)
            self.selected_id = None
            self._load()
            show_info(T("sched_deleted"))


# ============================================================================
#  واجهة: طباعة الوثائق
# ============================================================================

class DocumentsFrame(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.selected_candidate_id = None
        self._build(); self._load_candidates()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=15)
        wrap.pack(fill="both", expand=True)

        tk.Label(wrap, text=T("doc_title"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(fill="x", pady=(0, 5))
        tk.Label(wrap, text=T("doc_subtitle"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT,
                 anchor=A()).pack(fill="x", pady=(0, 15))

        # رسائل تحذيرية
        if not HAS_REPORTLAB:
            warn = tk.Frame(wrap, bg="#fef3c7", padx=15, pady=10)
            warn.pack(fill="x", pady=(0, 10))
            tk.Label(warn, text=T("doc_warn_reportlab"),
                     font=FONT_BOLD, bg="#fef3c7", fg="#92400e",
                     anchor=A()).pack(anchor=A())
        elif not HAS_ARABIC_LIBS:
            warn = tk.Frame(wrap, bg="#fef3c7", padx=15, pady=10)
            warn.pack(fill="x", pady=(0, 10))
            tk.Label(warn, text=T("doc_warn_arabic_libs"),
                     font=FONT_BOLD, bg="#fef3c7", fg="#92400e",
                     justify=J(), anchor=A()).pack(anchor=A())
        else:
            ok = tk.Frame(wrap, bg="#d1fae5", padx=15, pady=10)
            ok.pack(fill="x", pady=(0, 10))
            tk.Label(ok, text=T("doc_ok_arabic"),
                     font=FONT_BOLD, bg="#d1fae5", fg="#065f46",
                     anchor=A()).pack(anchor=A())

        bottom = tk.Frame(wrap, bg=COLOR_BG); bottom.pack(fill="both", expand=True)

        # ===== يمين: قائمة الوثائق (قابلة للتمرير) =====
        right_outer = tk.Frame(bottom, bg=COLOR_BG, width=300)
        right_outer.pack(side="right", fill="y", padx=(8, 0))
        right_outer.pack_propagate(False)

        # إطار الكارد الخارجي
        right_card_outer = tk.Frame(right_outer, bg=COLOR_BORDER, padx=1, pady=1)
        right_card_outer.pack(fill="both", expand=True)

        # Canvas قابل للتمرير داخل الكارد
        docs_canvas = tk.Canvas(right_card_outer, bg=COLOR_CARD, highlightthickness=0)
        docs_vsb = ttk.Scrollbar(right_card_outer, orient="vertical",
                                  command=docs_canvas.yview)
        docs_inner = tk.Frame(docs_canvas, bg=COLOR_CARD, padx=10, pady=10)

        docs_inner.bind("<Configure>",
                        lambda e: docs_canvas.configure(
                            scrollregion=docs_canvas.bbox("all")))
        win_id = docs_canvas.create_window((0, 0), window=docs_inner, anchor="nw")
        docs_canvas.configure(yscrollcommand=docs_vsb.set)

        # تمرير بعجلة الماوس
        def _on_mousewheel(event):
            docs_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        docs_canvas.bind("<MouseWheel>", _on_mousewheel)
        docs_inner.bind("<MouseWheel>", _on_mousewheel)

        # ضبط عرض الـ inner عند تغيير حجم الـ canvas
        def _resize_inner(event):
            docs_canvas.itemconfig(win_id, width=event.width)
        docs_canvas.bind("<Configure>", _resize_inner)

        docs_vsb.pack(side="right", fill="y")
        docs_canvas.pack(side="left", fill="both", expand=True)

        rc = docs_inner  # الآن rc هو الإطار الداخلي القابل للتمرير

        section_title(rc, T("doc_individual"), icon="📄")
        docs_individual = [
            (T("doc_dispatch"),      "📋", self._doc_dispatch_table),
            (T("doc_exam_form"),     "📄", self._doc_exam_form),
            (T("doc_contract_lbl"), "📜", self._doc_contract),
            (T("doc_cert_lbl"),     "🏛️", self._doc_certificate),
            (T("doc_receipt_lbl"),  "🧾", self._doc_payment_receipt),
        ]
        for label, icon, cmd in docs_individual:
            ModernButton(rc, label, cmd, icon=icon, color=COLOR_PRIMARY).pack(fill="x", pady=2)

        tk.Frame(rc, bg=COLOR_BORDER, height=2).pack(fill="x", pady=8)

        section_title(rc, T("doc_collective"), icon="📊")
        docs_group = [
            (T("doc_cand_list"),      "📑", self._doc_candidates_list),
            (T("doc_inst_list"),      "👥", self._doc_instructors_list),
            (T("doc_expenses_rep"),   "💸", self._doc_expenses_report),
            (T("doc_payments_rep"),   "💰", self._doc_payments_report),
        ]
        for label, icon, cmd in docs_group:
            ModernButton(rc, label, cmd, icon=icon, color=COLOR_PURPLE).pack(fill="x", pady=3)

        tk.Frame(rc, bg=COLOR_BORDER, height=2).pack(fill="x", pady=8)

        section_title(rc, T("doc_exams_sec"), icon="📝")
        ModernButton(rc, T("doc_exam_cands"), self._doc_exam_candidates_list,
                     icon="📋", color="#0369a1").pack(fill="x", pady=3)

        tip = tk.Frame(rc, bg=COLOR_PRIMARY_LIGHT, padx=10, pady=8)
        tip.pack(fill="x", pady=(12, 0))
        tk.Label(tip, text=T("doc_tip"),
                 font=FONT_SMALL, bg=COLOR_PRIMARY_LIGHT,
                 fg=COLOR_PRIMARY_DARK, justify=J(),
                 anchor=A()).pack(anchor=A())

        # يسار: قائمة المترشحين
        left = tk.Frame(bottom, bg=COLOR_BG); left.pack(side=So(), fill="both", expand=True)

        sb_o, sb = make_card(left, padding=10); sb_o.pack(fill="x", pady=(0, 10))
        tk.Label(sb, text="🔍", font=(FONT_FAMILY, 14),
                 bg=COLOR_CARD, fg=COLOR_PRIMARY).pack(side=S(), padx=(0, 8))
        self.search_var = tk.StringVar()
        self.search_var.trace("w", lambda *a: self._load_candidates())
        make_entry(sb, self.search_var, width=30).pack(side=S(), fill="x",
                                                       expand=True, ipady=5)
        tk.Label(sb, text=T("doc_search_cand"), font=FONT_BOLD,
                 bg=COLOR_CARD, fg=COLOR_TEXT, anchor=A()).pack(side=S(), padx=10)

        lo, lc = make_card(left, padding=10); lo.pack(fill="both", expand=True)
        section_title(lc, T("doc_choose_cand"), icon="👤")
        self.tree = create_treeview(lc,
            ("id","last_name","first_name","gender","license_type","registration_date"),
            (T("doc_col_num"),T("doc_col_last"),T("doc_col_first"),T("doc_col_gender"),T("doc_col_lic"),T("doc_col_date")),
            (50,140,140,80,110,140), height=18)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

    def _load_candidates(self):
        rows = CandidateDB.get_all(self.search_var.get())
        values = [(r['id'], r['last_name'], r['first_name'], r['gender'],
                   r['license_type'], r['registration_date']) for r in rows]
        insert_zebra(self.tree, values)

    def _on_select(self, event):
        sel = self.tree.selection()
        if sel:
            self.selected_candidate_id = self.tree.item(sel[0])['values'][0]

    def _check(self):
        if not HAS_REPORTLAB:
            show_error(T("doc_err_reportlab"))
            return False
        return True

    def _ask_date_range_for_doc(self):
        """يعرض حواراً صغيراً لتحديد فترة زمنية (من / إلى) قبل توليد التقرير.
        يُعيد (d_from, d_to) حيث أي منهما قد يكون '' لعدم التقييد.
        يُعيد None إذا ألغى المستخدم العملية."""
        today = date.today().strftime('%Y-%m-%d')
        year_start = date.today().strftime('%Y') + '-01-01'

        dlg = tk.Toplevel(self)
        dlg.title(T("period_title"))
        dlg.resizable(True, True)
        dlg.minsize(340, 220)
        dlg.grab_set()
        dlg.configure(bg=COLOR_CARD)

        tk.Label(dlg, text=T("period_filter"),
                 font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_TEXT).pack(padx=20, pady=(15, 5))
        tk.Label(dlg, text=T("period_hint"),
                 font=FONT_TINY, bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT).pack()

        frm = tk.Frame(dlg, bg=COLOR_CARD, padx=20, pady=10)
        frm.pack()
        tk.Label(frm, text=T("period_from"), font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_TEXT,
                 anchor=A(), width=6).grid(row=0, column=1, padx=5, pady=4, sticky="e")
        from_var = tk.StringVar(value=year_start)
        tk.Entry(frm, textvariable=from_var, font=FONT_MAIN, width=14,
                 bg=COLOR_INPUT_BG, relief="flat", bd=4).grid(row=0, column=0, padx=5, pady=4)

        tk.Label(frm, text=T("period_to"), font=FONT_BOLD, bg=COLOR_CARD, fg=COLOR_TEXT,
                 anchor=A(), width=6).grid(row=1, column=1, padx=5, pady=4, sticky="e")
        to_var = tk.StringVar(value=today)
        tk.Entry(frm, textvariable=to_var, font=FONT_MAIN, width=14,
                 bg=COLOR_INPUT_BG, relief="flat", bd=4).grid(row=1, column=0, padx=5, pady=4)

        tk.Label(frm, text="(YYYY-MM-DD)", font=FONT_TINY, bg=COLOR_CARD,
                 fg=COLOR_TEXT_LIGHT).grid(row=2, column=0, columnspan=2)

        result = [None]

        def _apply():
            d_f = from_var.get().strip()
            d_t = to_var.get().strip()
            def valid(s):
                if not s: return True
                try: datetime.strptime(s, '%Y-%m-%d'); return True
                except: return False
            if not valid(d_f):
                messagebox.showerror(T("msg_error"), T("period_bad_from"), parent=dlg)
                return
            if not valid(d_t):
                messagebox.showerror(T("msg_error"), T("period_bad_to"), parent=dlg)
                return
            result[0] = (d_f, d_t)
            dlg.destroy()

        def _all():
            result[0] = ("", "")
            dlg.destroy()

        btn_frm = tk.Frame(dlg, bg=COLOR_CARD, padx=20, pady=10)
        btn_frm.pack()
        ModernButton(btn_frm, T("period_apply"), _apply, icon="✔️",
                     color=COLOR_PRIMARY).pack(side=S(), padx=5)
        ModernButton(btn_frm, T("period_all"), _all, icon="🗓️",
                     color=COLOR_TEXT_LIGHT).pack(side=S(), padx=5)
        ModernButton(btn_frm, T("period_cancel"), dlg.destroy, icon="✕",
                     color=COLOR_DANGER).pack(side=S(), padx=5)

        dlg.wait_window()
        return result[0]

    def _get_candidate(self):
        if not self.selected_candidate_id:
            show_error(T("cand_sel_first")); return None
        return CandidateDB.get(self.selected_candidate_id)

    def _ask_save(self, default_name):
        return filedialog.asksaveasfilename(defaultextension=".pdf",
            filetypes=[("PDF Files","*.pdf"),("All Files","*.*")],
            initialfile=default_name)

    def _make_doc(self, path, **kwargs):
        defaults = dict(pagesize=A4, rightMargin=2*cm, leftMargin=2*cm,
                        topMargin=2*cm, bottomMargin=2*cm)
        defaults.update(kwargs)
        return SimpleDocTemplate(path, **defaults)

    def _trigger_print(self, path, title=None, default_name=None):
        """يعرض حوار الطابعة أولاً ثم حوار الحفظ ثم يرسل للطابعة."""
        if title is None:
            title = T("print_doc_lbl")
        printers = self._get_printers()

        dlg = tk.Toplevel()
        dlg.title(T("print_dlg_title"))
        dlg.resizable(True, True)
        dlg.grab_set()
        dlg.configure(bg=COLOR_BG)

        w, h = 440, 210
        dlg.minsize(w, h)
        dlg.update_idletasks()
        x = (dlg.winfo_screenwidth() - w) // 2
        y = (dlg.winfo_screenheight() - h) // 2
        dlg.geometry(f"{w}x{h}+{x}+{y}")

        tk.Label(dlg, text=f"{T('print_label')} {title}",
                 font=FONT_BOLD, bg=COLOR_BG, fg=COLOR_HEADER,
                 anchor=A()).pack(fill="x", padx=20, pady=(18, 4))

        tk.Label(dlg, text=T("print_choose"),
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT,
                 anchor=A()).pack(fill="x", padx=20)

        printer_var = tk.StringVar()
        if printers:
            printer_var.set(printers[0])

        cb = ttk.Combobox(dlg, textvariable=printer_var, values=printers,
                          font=FONT_MAIN, state="readonly",
                          style="Modern.TCombobox")
        cb.pack(fill="x", padx=20, pady=8)

        btn_frame = tk.Frame(dlg, bg=COLOR_BG)
        btn_frame.pack(fill="x", padx=20, pady=10)

        result = {"action": None, "path": path}

        def do_print():
            import shutil
            dn = default_name or (title + ".pdf")
            save_path = filedialog.asksaveasfilename(
                defaultextension=".pdf",
                filetypes=[("PDF Files", "*.pdf"), ("All Files", "*.*")],
                initialfile=dn)
            if save_path:
                try:
                    shutil.copy2(path, save_path)
                    result["path"] = save_path
                except Exception:
                    result["path"] = path
            result["action"] = "print"
            dlg.destroy()

        def do_open():
            result["action"] = "open"
            dlg.destroy()

        def do_cancel():
            result["action"] = "cancel"
            dlg.destroy()

        tk.Button(btn_frame, text=T("print_btn"), font=FONT_BOLD,
                  bg=COLOR_PRIMARY, fg="white", relief="flat",
                  padx=18, pady=6, cursor="hand2",
                  command=do_print).pack(side=S(), padx=(6, 0))
        tk.Button(btn_frame, text=T("print_open"), font=FONT_MAIN,
                  bg=COLOR_INFO, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2",
                  command=do_open).pack(side=S(), padx=6)
        tk.Button(btn_frame, text=T("print_cancel"), font=FONT_MAIN,
                  bg=COLOR_BORDER, fg=COLOR_TEXT, relief="flat",
                  padx=12, pady=6, cursor="hand2",
                  command=do_cancel).pack(side=So())

        dlg.wait_window()

        if result["action"] == "print":
            selected = printer_var.get()
            self._send_to_printer(result["path"], selected, title)
        elif result["action"] == "open":
            try:
                os.startfile(result["path"])
            except Exception:
                try:
                    import subprocess, sys
                    if sys.platform == "darwin":
                        subprocess.run(["open", result["path"]])
                    else:
                        subprocess.run(["xdg-open", result["path"]])
                except Exception as e:
                    show_error(f"{T('print_open_err')} {e}")

    def _get_printers(self):
        """يجلب قائمة الطابعات المثبتة على النظام."""
        printers = []
        try:
            import sys
            if sys.platform == "win32":
                try:
                    import winreg
                    key = winreg.OpenKey(
                        winreg.HKEY_LOCAL_MACHINE,
                        r"SYSTEM\CurrentControlSet\Control\Print\Printers")
                    i = 0
                    while True:
                        try:
                            printers.append(winreg.EnumKey(key, i))
                            i += 1
                        except OSError:
                            break
                except Exception:
                    import subprocess
                    result = subprocess.run(
                        ["wmic", "printer", "get", "name"],
                        capture_output=True, text=True)
                    for line in result.stdout.splitlines():
                        line = line.strip()
                        if line and line.lower() != "name":
                            printers.append(line)
            else:
                import subprocess
                result = subprocess.run(
                    ["lpstat", "-a"], capture_output=True, text=True)
                for line in result.stdout.splitlines():
                    parts = line.split()
                    if parts:
                        printers.append(parts[0])
        except Exception:
            pass
        if not printers:
            printers = [T("print_default")]
        return printers

    def _send_to_printer(self, path, printer_name, title):
        """يرسل ملف PDF إلى الطابعة المحددة."""
        import sys, subprocess
        _default = T("print_default")
        try:
            if sys.platform == "win32":
                if printer_name and printer_name != _default:
                    try:
                        subprocess.run(
                            ["SumatraPDF", "-print-to", printer_name, path],
                            capture_output=True)
                        show_info(f"{T('print_sent')} {title} {T('print_to')}\n{printer_name}")
                        return
                    except Exception:
                        pass
                os.startfile(path, 'print')
                show_info(T("print_ok"))
            else:
                cmd = ["lp", path]
                if printer_name and printer_name != _default:
                    cmd = ["lp", "-d", printer_name, path]
                subprocess.run(cmd)
                show_info(f"{T('print_sent')} {title} {T('print_to')}\n{printer_name}")
        except Exception as e:
            show_error(f"{T('print_err_title')}\n{e}\n\n{T('print_fallback')}")
            try:
                os.startfile(path)
            except Exception:
                pass

    # --- وثائق فردية ----------------------------------------------------------


            
    def _doc_exam_form(self):
        if not self._check(): return
        cand = self._get_candidate()
        if not cand: return

        import os
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm

        default_name = (f"formulaire_examen_{cand['last_name']}.pdf" if LANG == "fr"
                        else f"استمارة_امتحان_{cand['last_name']}.pdf")
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/exam_form_{int(_dtt.now().timestamp())}.pdf"

        school = SchoolInfoDB.get()
        c = canvas.Canvas(path, pagesize=A4)
        is_fr = LANG == "fr"

        def draw_text(x_cm, y_cm, text, font=ARABIC_FONT, size=11, align="right", raw=False):
            c.setFont(font, size)
            txt = str(text) if (is_fr or raw) else ar(str(text))
            if align == "center":
                c.drawCentredString(x_cm * cm, y_cm * cm, txt)
            elif align == "right":
                if is_fr:
                    c.drawString((_A4_W_CM - x_cm) * cm, y_cm * cm, txt)
                else:
                    c.drawRightString(x_cm * cm, y_cm * cm, txt)
            else:  # left
                if is_fr:
                    c.drawRightString((_A4_W_CM - x_cm) * cm, y_cm * cm, txt)
                else:
                    c.drawString(x_cm * cm, y_cm * cm, txt)
                
        def draw_line(x1, y1, x2, y2):
            c.line(x1 * cm, y1 * cm, x2 * cm, y2 * cm)
            
        def draw_dotted_line(x1, y1, x2, y2):
            c.line(x1 * cm, y1 * cm, x2 * cm, y2 * cm)
            
        def draw_rect(x, y, w, h):
            c.rect(x * cm, y * cm, w * cm, h * cm)

        # 1. Header / الترويسة
        draw_text(10.5, 28.5, _pdf_t("الجمهورية الجزائرية الديمقراطية الشعبية",
                                      "République Algérienne Démocratique et Populaire"),
                  ARABIC_FONT_BOLD, 13 if is_fr else 14, "center")
        draw_text(10.5, 27.8, _pdf_t("وزارة الداخلية و الجماعات المحلية و النقل",
                                      "Ministère de l'Intérieur, des Collectivités Locales et des Transports"),
                  ARABIC_FONT_BOLD, 9 if is_fr else 12, "center")

        wilaya = _no_wnum(school.get('wilaya', '').strip()) or '........'
        draw_text(10.5, 27.1,
                  _pdf_t(f"المندوبية الوطنية للأمن في الطرق ولاية : {wilaya}",
                         f"Délégation Nationale à la Sécurité Routière - Wilaya de : {wilaya}"),
                  ARABIC_FONT_BOLD, 10 if is_fr else 12, "center")
        
        # 2. Photo box / مربع الصورة
        c.setLineWidth(1.2)
        draw_rect(1.5, 25.2, 3.8, 3.2)
        draw_text(3.4, 26.7, _pdf_t("الصورة", "Photo"), ARABIC_FONT, 13, "center")

        # File date & number UNDER photo — labels outside rects, values inside
        c.setLineWidth(1.0)
        draw_rect(1.5, 24.1, 3.8, 0.9)
        draw_text(8.5, 24.45, _pdf_t("تاريخ إيداع الملف :", "Date de dépôt :"),
                  ARABIC_FONT_BOLD, 9, "right")
        draw_text(3.4, 24.35, cand.get('file_date', '') or "", "Helvetica-Bold", 9, "center")

        draw_rect(1.5, 23.0, 3.8, 0.9)
        draw_text(8.5, 23.35, _pdf_t("رقم الملف :", "N° du dossier :"),
                  ARABIC_FONT_BOLD, 9, "right")
        draw_text(3.4, 23.25, cand.get('file_number', '') or "", "Helvetica-Bold", 9, "center")

        # Main title / العنوان الرئيسي
        c.setFont(ARABIC_FONT_BOLD, 15 if is_fr else 18)
        _title_str = _pdf_t(ar("إستمارة الترشح للاجتياز إمتحانات رخصة السياقة"),
                            "Formulaire de candidature aux examens du permis de conduire")
        c.drawCentredString(10.5 * cm, 25.8 * cm, _title_str)
        c.drawCentredString(10.5 * cm + 0.3, 25.8 * cm, _title_str)
        c.setLineWidth(0.8)
        c.line(5.5 * cm, 25.6 * cm, 18.5 * cm, 25.6 * cm)

        # Category / الصنف المطلوب
        lic = cand.get('license_type', 'ب') or 'ب'
        draw_text(14.0, 24.9, _pdf_t(f"الصنف المطلوب : ........{lic}",
                                      f"Catégorie demandée : ........{lic}"),
                  ARABIC_FONT_BOLD, 13, "right")
        c.setLineWidth(0.8)
        c.line(6.0 * cm, 24.75 * cm, 13.5 * cm, 24.75 * cm)

        # School stamp box / مربع ختم المدرسة — wider (+1cm) taller (+0.5cm downward)
        c.setLineWidth(1.5)
        draw_rect(12.0, 21.0, 8.0, 3.5)
        draw_text(16.0, 23.7, _pdf_t("ختم مدرسة تعليم السياقة", "Cachet de l'auto-école"),
                  ARABIC_FONT_BOLD, 11, "center")
        draw_text(16.0, 21.3,
                  _pdf_t("في حالة مرشح حر يوضع ختم المندوبية الولائية للأمن الطرق",
                         "Pour candidat libre: cachet de la délégation de wilaya"),
                  ARABIC_FONT, 7 if is_fr else 8, "center")
        
        # Separator / خط فاصل
        c.setLineWidth(2.5)
        draw_line(1.5, 20.2, 20.0, 20.2)
        c.setLineWidth(1)
        
        # 3. Candidate info / معلومات المترشح
        draw_text(10.5, 19.4,
                  _pdf_t("معلومات خاصة بالمترشح", "Informations relatives au candidat"),
                  ARABIC_FONT_BOLD, 14, "center")
        
        # National ID / رقم التعريف
        draw_text(20.0, 18.3,
                  _pdf_t("رقم التعريف الوطني :", "N° d'identification national :"),
                  ARABIC_FONT_BOLD, 11, "right")
        c.setLineWidth(1.2)
        draw_rect(8.0, 18.0, 8.5, 0.8)
        draw_text(12.25, 18.2, cand.get('national_id','') or "", "Helvetica-Bold", 12, "center")
        
        draw_text(6.5, 18.3, _pdf_t("فصيلة الدم :", "Groupe sanguin :"),
                  ARABIC_FONT_BOLD, 11, "right")
        draw_rect(2.5, 18.0, 1.5, 0.8)
        draw_text(3.25, 18.2, cand.get('blood_type','') or "*", "Helvetica-Bold", 12, "center")
        
        # Name / الاسم واللقب
        last_ar  = cand.get('last_name','')  or ''
        first_ar = cand.get('first_name','') or ''
        last_fr  = cand.get('last_name_fr','')  or ''
        first_fr = cand.get('first_name_fr','') or ''

        draw_text(20.0, 17.2, _pdf_t("اللقب :", "Nom :"), ARABIC_FONT_BOLD, 11, "right")
        draw_text(17.5, 17.2, last_ar, ARABIC_FONT_BOLD, 11, "right")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1.5 * cm, 17.2 * cm,
                     f"Nom : {last_fr}" if last_fr else "Nom :")

        draw_text(20.0, 16.2, _pdf_t("الاسم :", "Prenom :"), ARABIC_FONT_BOLD, 11, "right")
        draw_text(17.5, 16.2, first_ar, ARABIC_FONT_BOLD, 11, "right")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1.5 * cm, 16.2 * cm,
                     f"Prenom : {first_fr}" if first_fr else "Prenom :")
        
        # Birth date & place / تاريخ ومكان الميلاد
        draw_text(20.0, 14.2, _pdf_t("تاريخ و مكان الميلاد :", "Date et lieu de naissance :"),
                  ARABIC_FONT_BOLD, 10, "right")
        draw_text(16.0, 14.2, cand.get('birth_date',''), "Helvetica-Bold", 10, "right")
        draw_text(13.5, 14.2, _pdf_t("بلدية :", "Commune :"), ARABIC_FONT_BOLD, 10, "right")
        draw_text(11.0, 14.2, cand.get('birth_place_commune',''), ARABIC_FONT_BOLD, 10, "right")
        draw_text(7.5, 14.2, _pdf_t("ولاية :", "Wilaya :"), ARABIC_FONT_BOLD, 10, "right")
        draw_text(5.0, 14.2, _no_wnum(cand.get('birth_place_wilaya','')), ARABIC_FONT_BOLD, 10, "right")
        
        # Parents / الوالدان
        draw_text(20.0, 13.2, _pdf_t("اسم الأب :", "Nom du père :"),
                  ARABIC_FONT_BOLD, 10, "right")
        draw_text(18.0, 13.2, cand.get('father_name',''), ARABIC_FONT_BOLD, 10, "right")
        draw_text(12.0, 13.2, _pdf_t("اسم و لقب الأم :", "Nom et prénom de la mère :"),
                  ARABIC_FONT_BOLD, 10, "right")
        draw_text(9.0, 13.2, cand.get('mother_name',''), ARABIC_FONT_BOLD, 10, "right")
        
        # Address / العنوان
        draw_text(20.0, 12.2, _pdf_t("العنوان :", "Adresse :"), ARABIC_FONT_BOLD, 10, "right")
        draw_text(18.5, 12.2, cand.get('current_address',''), ARABIC_FONT_BOLD, 10, "right")
        draw_text(12.5, 12.2, _pdf_t("بلدية :", "Commune :"), ARABIC_FONT_BOLD, 10, "right")
        draw_text(11.0, 12.2, cand.get('address_commune',''), ARABIC_FONT_BOLD, 10, "right")
        draw_text(7.5, 12.2, _pdf_t("ولاية :", "Wilaya :"), ARABIC_FONT_BOLD, 10, "right")
        draw_text(6.0, 12.2, _no_wnum(cand.get('address_wilaya','')), ARABIC_FONT_BOLD, 10, "right")
        
        # Marital status / الحالة العائلية
        draw_text(20.0, 11.2, _pdf_t("الحالة العائلية :", "Situation familiale :"),
                  ARABIC_FONT_BOLD, 11, "right")
        ms = cand.get('marital_status', '')
        draw_text(17.0, 11.2, _pdf_t("أعزب / عزباء", "Célibataire"), ARABIC_FONT_BOLD, 11, "right")
        draw_rect(14.3, 11.2, 0.4, 0.4)
        if ms == "أعزب": draw_text(14.5, 11.35, "X", "Helvetica-Bold", 12, "center")
        draw_text(13.5, 11.2, _pdf_t("متزوج (ة)", "Marié(e)"), ARABIC_FONT_BOLD, 11, "right")
        draw_rect(11.3, 11.2, 0.4, 0.4)
        if ms == "متزوج": draw_text(11.5, 11.35, "X", "Helvetica-Bold", 12, "center")
        draw_text(10.5, 11.2, _pdf_t("مطلق (ة)", "Divorcé(e)"), ARABIC_FONT_BOLD, 11, "right")
        draw_rect(8.3, 11.2, 0.4, 0.4)
        if ms == "مطلق": draw_text(8.5, 11.35, "X", "Helvetica-Bold", 12, "center")
        draw_text(7.5, 11.2, _pdf_t("أرمل (ة)", "Veuf(ve)"), ARABIC_FONT_BOLD, 11, "right")
        draw_rect(5.3, 11.2, 0.4, 0.4)
        if ms == "أرمل": draw_text(5.5, 11.35, "X", "Helvetica-Bold", 12, "center")
        
        # Phone / الهاتف — label outside rect (right), digits inside rect (left of label)
        draw_text(20.0, 10.2, _pdf_t("رقم الهاتف :", "N° de téléphone :"),
                  ARABIC_FONT_BOLD, 11, "right")
        draw_rect(9.0, 10.0, 7.0, 0.7)
        draw_text(12.5, 10.15, cand.get('phone','') or "", "Helvetica-Bold", 12, "center")
        
        # Nationality / الجنسية
        draw_text(20.0, 9.2, _pdf_t("الجنسية الأصلية :", "Nationalité d'origine :"),
                  ARABIC_FONT_BOLD, 11, "right")
        draw_text(17.5, 9.2, cand.get('nationality',''), ARABIC_FONT_BOLD, 11, "right")
        draw_text(11.0, 9.2, _pdf_t("الجنسية المكتسبة :", "Nationalité acquise :"),
                  ARABIC_FONT_BOLD, 11, "right")
        draw_text(8.0, 9.2, cand.get('second_nationality',''), ARABIC_FONT_BOLD, 11, "right")
        
        # Born abroad / المولودون بالخارج
        draw_text(20.0, 8.2,
                  _pdf_t("بالنسبة للأشخاص المولودين بالخارج / بلد الميلاد :",
                         "Pour les personnes nées à l'étranger / Pays de naissance :"),
                  ARABIC_FONT_BOLD, 10, "right")
        draw_text(11.5, 8.2, cand.get('birth_country','') or "", ARABIC_FONT_BOLD, 10, "right")
        draw_text(9.5, 8.2,
                  _pdf_t("سفارة أو قنصلية التسجيل :", "Ambassade ou consulat d'enregistrement :"),
                  ARABIC_FONT_BOLD, 10, "right")
        _emb = (cand.get('embassy','') or '') + (' ' + (cand.get('consulate','') or '')).rstrip()
        draw_text(5.0, 8.2, _emb.strip(), ARABIC_FONT_BOLD, 10, "right")
        
        # 4. Previously obtained categories table / جدول الأصناف
        draw_text(10.5, 7.3,
                  _pdf_t("الأصناف المتحصل عليها من قبل", "Catégories déjà obtenues"),
                  ARABIC_FONT_BOLD, 12, "center")
        
        y_tab = 6.8; rh = 0.45; rows = 11
        y_bot = y_tab - (rh * (rows + 2))
        c.setLineWidth(1.2)
        draw_rect(1.5, y_bot, 18.5, y_tab - y_bot)
        
        draw_line(6.3,  y_bot, 6.3,  y_tab)
        draw_line(11.1, y_bot, 11.1, y_tab)
        draw_line(16.0, y_bot, 16.0, y_tab)
        
        draw_line(16.0, y_tab - rh, 20.0, y_tab - rh)
        draw_line(18.0, y_bot, 18.0, y_tab - rh)
        
        draw_line(17.0, y_bot, 17.0, y_tab - 2*rh)
        draw_line(19.0, y_bot, 19.0, y_tab - 2*rh)
        
        draw_line(16.0, y_tab - 2*rh, 20.0, y_tab - 2*rh)
        c.setLineWidth(0.8)
        for i in range(1, rows + 1):
            y = y_tab - 2*rh - i*rh
            draw_line(1.5, y, 18.0, y)
            if i <= 6 or i == 11:
                draw_line(18.0, y, 20.0, y)
        
        yh1 = y_tab - rh/2 - 0.12
        yh2 = y_tab - 1.5*rh - 0.12
        draw_text(18.0, yh1, _pdf_t("الصنف", "Catégorie"), ARABIC_FONT_BOLD, 10, "center")
        draw_text(17.0, yh2, _pdf_t("الجديد", "Nouvelle"), ARABIC_FONT_BOLD, 9, "center")
        draw_text(19.0, yh2, _pdf_t("القديم", "Ancienne"), ARABIC_FONT_BOLD, 9, "center")
        draw_text(13.55, y_tab - rh - 0.12, _pdf_t("الرقم", "N°"), ARABIC_FONT_BOLD, 10, "center")
        draw_text(8.7,   y_tab - rh - 0.12, _pdf_t("التاريخ", "Date"), ARABIC_FONT_BOLD, 10, "center")
        draw_text(3.9,   y_tab - rh - 0.12, _pdf_t("هيئة الإصدار", "Organisme émetteur"),
                  ARABIC_FONT_BOLD, 10, "center")
        
        cats_new = [("A1","أ1"),("A","أ2"),("B","ب"),("D","د"),("C1","ج1"),("C","ج"),
                    ("BE","ب(هـ)"),("C1E","ج1(هـ)"),("CE","ج(هـ)"),("DE","د(هـ)"),("F","و")]
        cats_old = [("A1","أ1"),("A2","أ2"),("B","ب"),("D","د"),("C1","ج1"),("C2","ج2")]

        # Parse previous_licenses — format: "B|A00520567|20.03.13|بلدية مسكر" (comma-separated entries)
        prev_data = {}
        prev_raw = cand.get('previous_licenses', '') or ''
        for entry in prev_raw.split(','):
            parts = [p.strip() for p in entry.split('|')]
            if parts and parts[0]:
                cat_key = parts[0].upper()
                prev_data[cat_key] = {
                    'num':  parts[1] if len(parts) > 1 else '',
                    'date': parts[2] if len(parts) > 2 else '',
                    'org':  parts[3] if len(parts) > 3 else '',
                }

        for i, (cn, co) in enumerate(cats_new):
            yt = y_tab - 2*rh - (i+1)*rh + 0.12
            draw_text(16.5, yt, cn, "Helvetica", 9, "center")
            draw_text(17.5, yt, co, ARABIC_FONT, 9, "center")
            if i < 6:
                draw_text(18.5, yt, cats_old[i][0], "Helvetica", 9, "center")
                draw_text(19.5, yt, cats_old[i][1], ARABIC_FONT, 9, "center")
            # Fill row data if candidate has this category
            pinfo = prev_data.get(cn, {})
            if pinfo and any(pinfo.values()):
                num_v  = pinfo.get('num','')
                date_v = pinfo.get('date','')
                org_v  = pinfo.get('org','')
                draw_text(13.55, yt, num_v,  "Helvetica-Bold", 8, "center", raw=True)
                draw_text(8.7,   yt, date_v, "Helvetica-Bold", 8, "center", raw=True)
                draw_text(3.9,   yt, org_v,  ARABIC_FONT_BOLD, 8, "center")

        yt_merged = y_tab - 2*rh - 8.5*rh + 0.12
        draw_text(18.5, yt_merged, "E", "Helvetica-Bold", 11, "center")
        draw_text(19.5, yt_merged, "هـ", ARABIC_FONT_BOLD, 11, "center")

        yt_f = y_tab - 2*rh - 11*rh + 0.12
        draw_text(18.5, yt_f, "F", "Helvetica", 9, "center")
        draw_text(19.5, yt_f, "و", ARABIC_FONT, 9, "center")

        c.save()
        self._trigger_print(path, T("doc_enroll_form"), default_name=default_name)

    def _doc_training_card(self):
        if not self._check(): return
        cand = self._get_candidate()
        if not cand: return

        default_name = (f"fiche_formation_{cand['last_name']}.pdf" if LANG == "fr"
                        else f"بطاقة_تكوين_{cand['last_name']}.pdf")
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/training_card_{int(_dtt.now().timestamp())}.pdf"

        school = SchoolInfoDB.get()
        from reportlab.pdfgen import canvas
        c = canvas.Canvas(path, pagesize=A4)
        is_fr = LANG == "fr"

        def draw_text(x_cm, y_cm, text, font=ARABIC_FONT, size=11, align="right", bold=False):
            f = ARABIC_FONT_BOLD if bold else font
            c.setFont(f, size)
            txt = str(text) if is_fr else ar(str(text))
            if align == "center":
                c.drawCentredString(x_cm * cm, y_cm * cm, txt)
            elif align == "right":
                if is_fr:
                    c.drawString((_A4_W_CM - x_cm) * cm, y_cm * cm, txt)
                else:
                    c.drawRightString(x_cm * cm, y_cm * cm, txt)
            else:
                if is_fr:
                    c.drawRightString((_A4_W_CM - x_cm) * cm, y_cm * cm, txt)
                else:
                    c.drawString(x_cm * cm, y_cm * cm, txt)

        def draw_rect(x, y, w, h, lw=1):
            c.setLineWidth(lw)
            c.rect(x * cm, y * cm, w * cm, h * cm)

        def draw_line(x1, y1, x2, y2, lw=1):
            c.setLineWidth(lw)
            c.line(x1 * cm, y1 * cm, x2 * cm, y2 * cm)

        # Header / الترويسة
        draw_text(10.5, 28.7,
                  _pdf_t("الجمهورية الجزائرية الديمقراطية الشعبية",
                         "République Algérienne Démocratique et Populaire"),
                  ARABIC_FONT_BOLD, 11 if is_fr else 12, "center")
        
        school_w = SchoolInfoDB.get()
        school_wilaya = _no_wnum(school_w.get('wilaya', '').strip()) or '........'
        y_head = 27.8
        draw_text(20.0, y_head,
                  _pdf_t(f"ولاية {school_wilaya}", f"Wilaya de {school_wilaya}"),
                  ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y_head-0.6,
                  _pdf_t("المركز الوطني لرخصة السياقة",
                         "Centre National du Permis de Conduire"),
                  ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y_head-1.2,
                  _pdf_t(f"الفرع المحلي لولاية {school_wilaya}",
                         f"Antenne locale - Wilaya de {school_wilaya}"),
                  ARABIC_FONT_BOLD, 11)
        
        # Photo/stamp box
        draw_rect(1.5, 25.5, 2.5, 3.5)
        
        # Main title / العنوان الرئيسي
        c.setLineWidth(1.5)
        c.rect(6.5*cm, 24.5*cm, 8.5*cm, 1.2*cm)
        draw_text(10.75, 25.1,
                  _pdf_t("بطاقة التكوين (التقييم) المترشحين لرخصة السياقة",
                         "Fiche de formation (évaluation) des candidats au permis de conduire"),
                  ARABIC_FONT_BOLD, 11 if is_fr else 14, "center")
        draw_text(10.75, 24.0,
                  _pdf_t("(مادة قانون المرور)", "(Matière : Code de la route)"),
                  ARABIC_FONT_BOLD, 12, "center")
        
        # General fields / حقول عامة
        y_f = 22.5
        draw_text(20.0, y_f,
                  _pdf_t(f"مدرسة تعليم السياقة: {school.get('name','.................................')}",
                         f"Auto-école : {school.get('name','.................................')}"),
                  ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y_f-1.0,
                  _pdf_t(f"رقم التسجيل: {cand['id']} ..................... التاريخ: {date.today().strftime('%Y/%m/%d')}",
                         f"N° d'inscription : {cand['id']} ..................... Date : {date.today().strftime('%Y/%m/%d')}"),
                  ARABIC_FONT_BOLD, 11)
        
        # Target category table / جدول الأصناف المستهدفة
        y_tab = 20.0
        cols_ar = ["أ1","أ2","ب","ب(هـ)","ج1","ج1(هـ)","ج2","ج2(هـ)","د","د(هـ)","ج","و"]
        cols_fr = ["A1","A2","B","BE","C1","C1E","C2","C2E","D","DE","CE","F"]
        cols = cols_fr if is_fr else cols_ar
        w_cell = 1.3
        h_cell = 0.8
        
        draw_rect(17.3, y_tab, 2.7, h_cell)
        draw_text(18.65, y_tab+0.25,
                  _pdf_t("الصنف المستهدف", "Catégorie visée"),
                  ARABIC_FONT_BOLD, 10, "center")
        
        for i, cat in enumerate(cols):
            x = 17.3 - (i+1)*w_cell
            draw_rect(x, y_tab, w_cell, h_cell)
            draw_text(x + w_cell/2, y_tab+0.25, cat, ARABIC_FONT_BOLD, 10, "center")
            
            mapping = ["A1","A2","B","BE","C1","C1E","C2","C2E","D","DE","CE","F"]
            if cand.get('license_type') == mapping[i]:
                draw_line(x, y_tab, x+w_cell, y_tab+h_cell, lw=1.5)
                draw_line(x, y_tab+h_cell, x+w_cell, y_tab, lw=1.5)

        # Candidate info / معلومات المترشح
        y_info = 18.0
        draw_text(20.0, y_info,
                  _pdf_t(f"الإسم و اللقب : {cand['last_name']} {cand['first_name']}",
                         f"Nom et Prénom : {cand['last_name']} {cand['first_name']}"),
                  ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y_info-0.8,
                  _pdf_t(f"تاريخ الميلاد : {cand['birth_date']}",
                         f"Date de naissance : {cand['birth_date']}"),
                  ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y_info-1.6,
                  _pdf_t(f"العنوان : {cand.get('current_address','')}",
                         f"Adresse : {cand.get('current_address','')}"),
                  ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y_info-2.4,
                  _pdf_t(f"تاريخ التسجيل بمدرسة سياقة السيارة : {cand['registration_date']}",
                         f"Date d'inscription à l'auto-école : {cand['registration_date']}"),
                  ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y_info-3.2,
                  _pdf_t("تاريخ إيداع الملف بالمديرية : .........................",
                         "Date de dépôt du dossier à la direction : ........................."),
                  ARABIC_FONT_BOLD, 11)
        draw_text(20.0, y_info-4.0,
                  _pdf_t("رقم التسجيل : .........................",
                         "N° d'enregistrement : ........................."),
                  ARABIC_FONT_BOLD, 11)
        
        # ── جلب حصص المترشح من قاعدة البيانات ──
        raw_sessions = SessionDB.get_all(candidate_id=cand['id'])
        raw_sessions.sort(key=lambda s: (s.get('session_date',''), s.get('session_time','')))

        # Session grid / الجدول الرئيسي للحصص
        y_grid = 12.5
        def draw_grid_block(x_start, num_start, num_end):
            cw = [0.8, 2.5, 2.0, 2.5]
            th = 0.55
            curr_y = y_grid
            headers_ar = ["الرقم", "تاريخ الدروس", "ساعات الدروس", "إمضاء المترشح"]
            headers_fr = ["N°", "Date des cours", "Heures de cours", "Signature"]
            headers = headers_fr if is_fr else headers_ar
            cx = x_start
            for j, h in enumerate(headers):
                draw_rect(cx, curr_y, cw[j], th)
                draw_text(cx + cw[j]/2, curr_y+0.15, h, ARABIC_FONT_BOLD, 8, "center")
                cx += cw[j]

            for r in range(num_start, num_end + 1):
                curr_y -= th
                cx = x_start
                # الحصة الموافقة لهذا الرقم (0-indexed)
                sess = raw_sessions[r - 1] if (r - 1) < len(raw_sessions) else None
                for j in range(4):
                    draw_rect(cx, curr_y, cw[j], th)
                    if j == 0:
                        draw_text(cx + cw[j]/2, curr_y+0.15, str(r), "Helvetica", 9, "center")
                    elif j == 1 and sess:
                        # تاريخ الحصة
                        draw_text(cx + cw[j]/2, curr_y+0.15,
                                  str(sess.get('session_date', '')),
                                  "Helvetica", 8, "center")
                    elif j == 2 and sess:
                        # وقت الحصة + المدة
                        t   = str(sess.get('session_time', ''))
                        dur = str(sess.get('duration', ''))
                        cell_txt = f"{t}  ({dur}mn)" if t else (f"{dur}mn" if dur else "")
                        draw_text(cx + cw[j]/2, curr_y+0.15, cell_txt, "Helvetica", 7, "center")
                    cx += cw[j]

        draw_grid_block(11.5, 1, 13)
        draw_grid_block(2.0, 14, 25)
        
        # Footer / التذييل
        draw_text(20.0, 3.5,
                  _pdf_t("ختم وتوقيع مدرسة تعليم السياقة",
                         "Cachet et signature de l'auto-école"),
                  ARABIC_FONT_BOLD, 11)
        draw_text(5.0, 3.5,
                  _pdf_t("إمضاء المترشح", "Signature du candidat"),
                  ARABIC_FONT_BOLD, 11)
        
        c.save()
        self._trigger_print(path, T("doc_training_card"), default_name=default_name)

    def _doc_contract(self):
        if not self._check(): return
        cand = self._get_candidate()
        if not cand: return
        default_name = f"عقد_تكوين_{cand.get('last_name','')}.pdf"
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/contract_{int(_dtt.now().timestamp())}.pdf"
        school = SchoolInfoDB.get()

        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.pdfbase.pdfmetrics import stringWidth

        page_w, page_h = A4
        c = rl_canvas.Canvas(path, pagesize=A4)

        MR    = 19.5          # cm — الحافة اليمنى للنص
        ML    = 1.5           # cm — الحافة اليسرى
        TW    = (MR - ML)*cm  # عرض النص بالنقاط
        TOP   = 28.2          # cm — أعلى سطر
        BOT   = 2.0           # cm — أسفل حد
        y     = [TOP]

        def _new_page():
            c.showPage(); y[0] = TOP

        def _chk(need=0.8):
            if y[0] < BOT + need: _new_page()

        def _t(text, x=MR, size=11, bold=False, align="right"):
            _chk()
            f = ARABIC_FONT_BOLD if bold else ARABIC_FONT
            c.setFont(f, size)
            t = ar(str(text)) if text else ""
            if align == "right":
                c.drawRightString(x*cm, y[0]*cm, t)
            elif align == "center":
                c.drawCentredString(page_w/2, y[0]*cm, t)
            else:
                c.drawString(ML*cm, y[0]*cm, t)

        def _nl(sp=0.65): y[0] -= sp

        def _dots(v, n=35): return str(v).strip() if (v and str(v).strip()) else "."*n

        def _field(lbl, val, n=35):
            _t(f"{lbl}  {_dots(val, n)}"); _nl()

        def _two(l1, v1, l2, v2, n=20):
            _t(f"  {l2}  {_dots(v2, n)}                {l1}  {_dots(v1, n)}"); _nl()

        def _wrap(text, size=11, lh=0.6, x=MR, bold=False):
            """يلتف النص تلقائياً إذا تجاوز عرض الصفحة."""
            f = ARABIC_FONT_BOLD if bold else ARABIC_FONT
            words = str(text).split()
            buf = []
            for w in words:
                test = " ".join(buf + [w])
                if stringWidth(ar(test), f, size) > TW - 0.5*cm and buf:
                    _t(" ".join(buf), x=x, size=size, bold=bold); _nl(lh)
                    buf = [w]
                else:
                    buf.append(w)
            if buf:
                _t(" ".join(buf), x=x, size=size, bold=bold); _nl(lh)

        def _sec(txt):
            _nl(0.2); _chk(1.2)
            _t(txt, bold=True, size=12); _nl(0.75)

        def _sub(txt):
            _t(txt, bold=True); _nl(0.6)

        def _bullet(txt, pref="•"):
            _wrap(f"{pref}  {txt}")

        # ══════════════════════════════════════════════════════════════════
        #  الصفحة 1 — بيانات الطرفين
        # ══════════════════════════════════════════════════════════════════
        _t("عقد تعليم سياقة السيارات", bold=True, size=16, align="center"); _nl(1.1)
        _t("بين  :", bold=True); _nl(0.8)

        # — المدرسة —
        _t("مالك مدرسة تعليم سياقة السيارات  :", bold=True); _nl(0.8)

        acr      = school.get('accreditation_number','')
        acr_date = school.get('accreditation_date','')
        _t(f"الاعتماد رقم  {_dots(acr,25)}    الصادر في  {_dots(acr_date,20)}"); _nl()

        owner_n  = school.get('owner_name','') or school.get('name','')
        owner_bd = school.get('owner_birth_date','')
        owner_bp = school.get('owner_birth_place','')
        _t(f"السيد )ة(  {_dots(owner_n,28)}  :  المولود )ة( في  {_dots(owner_bd,16)}  بـ  {_dots(owner_bp,14)}"); _nl()

        _field("العنوان  :", school.get('address',''), 60)

        rep_n  = school.get('representative_name','')
        rep_bd = school.get('representative_birth_date','')
        rep_bp = school.get('representative_birth_place','')
        _t(f"الممثل من طرف السيد )ة(  {_dots(rep_n,22)}  :  المولود )ة( في  {_dots(rep_bd,14)}  بـ  {_dots(rep_bp,12)}"); _nl()

        _field("اسم الشركة  :", school.get('name',''), 50)
        _field("العنوان المهني  :", school.get('address',''), 50)

        commune  = school.get('address_commune','') or ""
        daira    = school.get('address_daira','') or ""
        wilaya_s = _no_wnum(school.get('wilaya','')) or ""
        _t(f"ولاية  {_dots(wilaya_s,16)}  :  دائرة  {_dots(daira,16)}  :  بلدية  {_dots(commune,16)}"); _nl()

        phone_s   = school.get('phone','')
        owner_em  = school.get('owner_email','')
        _t(f"البريد الإلكتروني  {_dots(owner_em,28)}            الهاتف  {_dots(phone_s,20)}"); _nl()

        lic_type = cand.get('license_type','ب') or 'ب'
        _field("صنف )أصناف( رخصة السياقة محل التعليم", lic_type, 30)
        ins_num = cand.get('insurance_number','')
        _t(f"رقم التأمين على الحوادث لفائدة المترشح )ة(  {_dots(ins_num,35)}  :"); _nl(0.9)

        # — المترشح —
        _t("والمترشح )ة(  :", bold=True); _nl(0.8)

        cname = f"{cand.get('last_name','')} {cand.get('first_name','')}".strip()
        bdate = cand.get('birth_date','') or ""
        bcom  = cand.get('birth_place_commune','') or ""
        _t(f"المولود )ة( في  {_dots(bdate,18)}          الاسم  {_dots(cand.get('first_name',''),18)}          اللقب  {_dots(cand.get('last_name',''),18)}"); _nl()

        addr = cand.get('current_address','') or cand.get('address_commune','') or ""
        _field("القاطن )ة(  :", addr, 60)

        cph   = cand.get('phone','')
        cemail = cand.get('email','')
        _t(f"البريد الإلكتروني  {_dots(cemail,30)}              الهاتف  {_dots(cph,20)}"); _nl(0.9)

        _t("عند الاقتضاء، يمثله )ها( الممثل الشرعي  :", bold=False); _nl()
        g_last  = cand.get('guardian_last_name','')
        g_first = cand.get('guardian_first_name','')
        g_bdate = cand.get('guardian_birth_date','')
        g_phone = cand.get('guardian_phone','')
        g_addr  = cand.get('guardian_address','')
        _t(f"المولود )ة( في  {_dots(g_bdate,16)}          الاسم  {_dots(g_first,16)}          اللقب  {_dots(g_last,16)}"); _nl()
        _t(f"الهاتف  {_dots(g_phone,18)}              العنوان  {_dots(g_addr,36)}"); _nl(1.0)

        _t("تم الاتفاق على ما يأتي  :", bold=True, size=12); _nl(0.4)

        # ══════════════════════════════════════════════════════════════════
        #  الصفحة 2 — بنود العقد
        # ══════════════════════════════════════════════════════════════════
        _new_page()

        # أولا — موضوع العقد
        _sec("أولا – موضوع العقد  :")
        _wrap("يهدف هذا العقد إلى تحديد حقوق وواجبات كل من الطرفين، يسمح للمترشح )ة( ببلوغ المستوى المطلوب ليكون مؤهلاً لاجتياز الاختبارات النظرية والتطبيقية لرخصة السياقة لصنف من الأصناف الآتية  :")
        _nl(0.2)

        # جدول الأصناف
        all_cats = ["أ1", "أ", "ب", "ج1", "ج", "د", "و", "ب)هـ(", "ج1)هـ(", "ج)هـ(", "د)هـ("]
        col_w = TW / len(all_cats)
        row_h = 0.7*cm
        tbl_x = ML*cm
        tbl_y = (y[0] - 0.1)*cm
        c.setFont(ARABIC_FONT, 9)
        for i, cat in enumerate(all_cats):
            cx = tbl_x + i * col_w
            c.rect(cx, tbl_y - row_h, col_w, row_h)
            c.rect(cx, tbl_y - 2*row_h, col_w, row_h)
            c.drawCentredString(cx + col_w/2, tbl_y - row_h + 0.15*cm, ar(cat))
            if cat.strip() == lic_type.strip():
                c.setFillColorRGB(0.2, 0.4, 0.8)
                c.setFont(ARABIC_FONT_BOLD, 12)
                c.drawCentredString(cx + col_w/2, tbl_y - 2*row_h + 0.12*cm, ar("✓"))
                c.setFillColorRGB(0, 0, 0)
                c.setFont(ARABIC_FONT, 9)
        y[0] -= 1.8; _nl(0.4)

        # ثانيا — مدة العقد
        _sec("ثانيا – مدة العقد  :")
        _wrap("يبرم هذا العقد حسب مدة التكوين المطلوبة، على ألا تتجاوز اثني عشر )12( شهرا، ابتداء من تاريخ توقيعه. وعند انتهاء هذا الأجل، يجب التفاوض مجددا بشأن العقد.")
        _wrap("يشرع في التكوين بمجرد التوقيع عليه.")

        # ثالثا — التزامات المدرسة
        _sec("ثالثا – التزامات وحقوق مدرسة تعليم السياقة  :")
        _wrap("تتعهد مدرسة تعليم السياقة بتعليم تقنيات سياقة السيارات من خلال تزويد المترشح )ة( بالوسائل اللازمة للوصول إلى المستوى المطلوب وتقديمه في حدود أماكن الامتحان المتاحة لاختبارات رخصة السياقة.")
        _wrap("في حالة الفشل في الامتحان وبعد موافقة المترشح )ة(، تتعهد مدرسة تعليم السياقة، من خلال تكوين تكميلي، بتقديم المترشح )ة(، ضمن نفس الشروط، في أقرب الآجال وفي حدود أماكن الامتحان التي يتم تخصيصها لها من قبل الإدارة.")
        _nl(0.1)
        _sub("1 – برنامج التكوين وسيره  :")
        _wrap("تقدم مدرسة تعليم السياقة تكوينا مطابقا للبرنامج المنصوص عليه في القرار المؤرخ في 9 جمادى الثانية عام 1440 الموافق 14 فبراير سنة 2019 الذي يحدد برنامج تعليم سياقة السيارات.")
        _wrap("يتم تحديد الرزنامة التقديرية للحصص التعليمية من قبل مدرسة تعليم السياقة بالاتفاق مع المترشح )ة(، وتسلّم نسخة منها لهذا الأخير )ة(.")
        _wrap("يترتب على كل حصة تقييم:")
        _bullet("تعلم مدرسة تعليم السياقة المترشح )ة( بمدى تقدمه في التكوين.", "–")
        _bullet("تخصص ساعة واحدة من التكوين للدرس النظري.", "–")
        _wrap("وتقسم الساعة المخصصة للسياقة في الطرق، عموما، على النحو الآتي  :")
        _bullet("خمس )5( دقائق: تكرس لتحديد الأهداف بالاستناد إلى كتيب التعليم الذي يسلّمه المركز الوطني لرخص السياقة،")
        _bullet("من خمس وأربعين )45( إلى خمسين )50( دقيقة: تكرس للسياقة الفعلية قصد بلوغ الأهداف المحددة وتقييم التدريب،")
        _bullet("من خمس )5( إلى عشر )10( دقائق: لتقديم الحصيلة والتعليقات.")
        _wrap("لا يمكن أن تتجاوز مدة السياقة العملية ساعتين )2( متتاليتين لكل مترشح )ة(.")
        _wrap("يتم تحديد كيفيات إلغاء الحصص و/أو الامتحانات، باتفاق الطرفين.")
        _nl(0.1)
        _sub("2 – الوسائل البيداغوجية والتقنية  :")
        _wrap("تسخّر مدرسة تعليم السياقة جميع الكفاءات الضرورية لكي يبلغ المترشح )ة( مستوى الأداء المطلوب، وتقدم الدروس النظرية والتطبيقية في مدرسة تعليم السياقة، حصريا بواسطة ممرنين حائزين الأصناف المدرّسة. ويجب أن تكون المركبات المستعملة مطابقة للمواصفات الواردة في القرار المؤرخ في 9 جمادى الثانية عام 1440 الموافق 14 فبراير سنة 2019 الذي يحدد دفتر شروط مدارس تعليم السياقة.")
        _nl(0.1)
        _sub("3 – الإجراءات الإدارية  :")
        _wrap("تقوم مدرسة تعليم السياقة، باسم المترشح )ة( ونيابة عنه )ها(، بجميع الإجراءات اللازمة لدى الإدارة من أجل تسجيل ملف الامتحان الخاص به )ها(. ويتم إخطار المترشح من طرف مدرسة تعليم السياقة بقائمة الوثائق التي تشكل ملف الامتحان.")
        _wrap("وفي حالة عدم احترام المترشح )ة( للشروط البيداغوجية أو رزنامة التكوين، تحتفظ مدرسة تعليم السياقة بإمكانية تأجيل تقدمه )ها( لامتحانات رخصة السياقة، شريطة إعلامه )ها( كتابيا، مع تقديم تبرير ورزنامة جديدة. وبعد امتثال المترشح )ة( لتعليمات مدرسة تعليم السياقة، يقدم لاختبارات رخصة السياقة.")
        _wrap("يجب على مدرسة تعليم السياقة، عند دفع تكاليف التكوين، تسليم المترشح )ة( وثيقة الدفع.")

        # رابعا — التزامات المترشح
        _sec("رابعا – التزامات وحقوق المترشح )ة(  :")
        _wrap("يلتزم المترشح )ة( باحترام النظام الداخلي للمدرسة وكل تعليمة مقدمة ذات صلة بالتكوين المقدم.")
        _nl(0.1)
        _sub("1 – تسديد المبالغ المستحقة  :")
        _wrap("يتعين على المترشح )ة( تسديد المبالغ المستحقة لمدرسة تعليم السياقة طبقا لكيفيات التسديد التي تم اختيارها.")
        _wrap("يمكن مدرسة تعليم السياقة فسخ هذا العقد عند عدم تسديد المبالغ المستحقة في الآجال المحددة.")

        # خامسا — تكلفة التكوين
        _sec("خامسا – تكلفة التكوين وكيفيات الدفع  :")
        _sub("– تكلفة التكوين  :")
        _wrap("تحدد تكلفة التكوين المنصوص عليها في هذا العقد حسب الصنف المدرّس، كما يأتي  :")
        _nl(0.2)

        # جدول التسعيرة
        _chk(3.5)
        th = ["التسعيرة الإجمالية مع كل الرسوم", "التسعيرة بالساعة مع كل الرسوم", "عدد الساعات", "الخدمات"]
        rows = [
            ["", "", "", "دروس نظرية"],
            ["", "", "", "دروس تطبيقية"],
        ]
        cws   = [4.5*cm, 4.0*cm, 3.0*cm, 3.0*cm]
        t_x   = ML*cm
        rh    = 0.75*cm
        ty    = y[0]*cm
        c.setFont(ARABIC_FONT_BOLD, 8)
        for ci, hdr in enumerate(th):
            rx = t_x + sum(cws[:ci])
            c.rect(rx, ty - rh, cws[ci], rh)
            c.drawCentredString(rx + cws[ci]/2, ty - rh + 0.18*cm, ar(hdr))
        y[0] -= rh/cm
        c.setFont(ARABIC_FONT, 9)
        for row in rows:
            ry = y[0]*cm
            for ci, cell in enumerate(row):
                rx = t_x + sum(cws[:ci])
                c.rect(rx, ry - rh, cws[ci], rh)
                if cell:
                    c.drawCentredString(rx + cws[ci]/2, ry - rh + 0.18*cm, ar(cell))
            y[0] -= rh/cm
        _nl(0.5)

        total_str = f"{cand.get('total_amount', 0):,.0f}  دج" if cand.get('total_amount') else "."*30
        _t(f"السعر الإجمالي مع كل الرسوم  :  {total_str}"); _nl(0.5)
        _bullet("تحدد حقوق الامتحان للحصول على رخصة السياقة وحقوق الدخول إلى مضمار الامتحان طبقا للتشريع والتنظيم المعمول بهما.")
        _nl(0.1)
        _sub("– كيفيات الدفع  :")
        _wrap("يتم الدفع حسب مراحل تنفيذ العقد تبعا للكيفيات المتفق عليها بين أطراف العقد.")

        # سادسا — تعليق العقد وفسخه
        _sec("سادسا – تعليق العقد وفسخه  :")
        _wrap("يمكن تعليق هذا العقد باتفاق مشترك لمدة لا تتجاوز اثني عشر )12( شهرا. وعند انتهاء هذا الأجل، يجب التفاوض مجددا بشأنه.")
        _wrap("يمكن أن يفسخ هذا العقد من أحد طرفيه في الحالات المتفق عليها باتفاق مشترك.")

        # سابعا — طرق الطعن
        _sec("سابعا – طرق الطعن  :")
        _wrap("في حالة عدم حل النزاع المترتب على عدم احترام الالتزامات من طرفي العقد أو أحدهما، وديا، يمكن رفعه، في هذه الحالة، أمام المحكمة المختصة.")
        _nl(0.3)
        _wrap("أُعدّ هذا العقد في نسختين )2(، تسلّم إحداهما للمترشح )ة(.")
        _nl(0.5)

        # التوقيعات
        _chk(3.0)
        wilaya_sig = _no_wnum(school.get('wilaya','').strip()) or '........'
        _t(f"حرّر بـ  {_dots(wilaya_sig, 20)}              في  {'.'*20}"); _nl(1.8)

        sig_y = y[0]*cm
        c.setFont(ARABIC_FONT_BOLD, 11)
        c.drawCentredString(ML*cm + 4.0*cm, sig_y + 0.4*cm, ar('"قرئ وصودق عليه"'))
        c.drawCentredString(ML*cm + 4.0*cm, sig_y - 0.1*cm, ar("توقيع المترشح )ة( أو"))
        c.drawCentredString(ML*cm + 4.0*cm, sig_y - 0.7*cm, ar("ممثله )ها( الشرعي"))

        c.drawCentredString(MR*cm - 4.0*cm, sig_y + 0.4*cm, ar('"قرئ وصودق عليه"'))
        c.drawCentredString(MR*cm - 4.0*cm, sig_y - 0.1*cm, ar("عن مدرسة تعليم السياقة"))
        c.drawCentredString(MR*cm - 4.0*cm, sig_y - 0.7*cm, ar("توقيع الممثل الشرعي"))

        c.save()
        self._trigger_print(path, T("doc_contract"), default_name=default_name)



    def _doc_certificate(self):
        if not self._check(): return
        cand = self._get_candidate()
        if not cand: return
        default_name = (f"attestation_administrative_{cand['last_name']}.pdf" if LANG == "fr"
                        else f"شهادة_إدارية_{cand['last_name']}.pdf")
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/certificate_{int(_dtt.now().timestamp())}.pdf"

        school = SchoolInfoDB.get()
        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        import tempfile, datetime

        is_fr = LANG == "fr"
        stages = TrainingDB.get_by_candidate(cand['id'])
        circuit_stage = next((s for s in stages if s['stage_type'] == 'circuit'), None)
        exam_date = ""
        if circuit_stage and circuit_stage.get('end_date'):
            exam_date = circuit_stage['end_date']
        elif circuit_stage and circuit_stage.get('start_date'):
            exam_date = circuit_stage['start_date']

        page_w, page_h = A4
        c = rl_canvas.Canvas(path, pagesize=A4)

        def txt_right(text, y_cm, font=ARABIC_FONT, size=12):
            c.setFont(font, size)
            txt = str(text) if is_fr else ar(str(text))
            if is_fr:
                c.drawString(2*cm, y_cm * cm, txt)
            else:
                c.drawRightString((page_w - 2*cm), y_cm * cm, txt)

        def txt_center(text, y_cm, font=ARABIC_FONT, size=12):
            c.setFont(font, size)
            txt = str(text) if is_fr else ar(str(text))
            c.drawCentredString(page_w / 2, y_cm * cm, txt)

        # Header
        txt_center(_pdf_t("الجمهورية الجزائرية الديمقراطية الشعبية",
                          "République Algérienne Démocratique et Populaire"),
                   27.5, font=ARABIC_FONT_BOLD, size=12 if is_fr else 13)
        txt_center(_pdf_t("المندوبية الوطنية للأمن في الطرق",
                          "Délégation Nationale à la Sécurité Routière"),
                   26.7, size=11)
        wilaya_school = _no_wnum(school.get('wilaya', '').strip()) or _no_wnum(school.get('address', ''))
        txt_center(_pdf_t(f"المندوبية الولائية للأمن في الطرق لولاية {wilaya_school}",
                          f"Délégation de Wilaya à la Sécurité Routière - Wilaya de {wilaya_school}"),
                   25.9, size=10 if is_fr else 11)
        txt_center(_pdf_t(f"مدرسة تعليم السياقة  {school.get('name', '')}",
                          f"Auto-école : {school.get('name', '')}"),
                   25.1, size=11)

        c.setLineWidth(1)
        c.line(2*cm, 24.7*cm, page_w - 2*cm, 24.7*cm)

        title_w = 9*cm if is_fr else 7*cm
        title_x = (page_w - title_w) / 2
        title_y = 23.3*cm
        c.setLineWidth(1.2)
        c.rect(title_x, title_y, title_w, 1*cm)
        txt_center(_pdf_t("شهادة ادارية", "Attestation Administrative"),
                   23.6, font=ARABIC_FONT_BOLD, size=14)

        school_name = school.get('name', '........')
        school_city = school.get('address', '........')
        full_name = f"{cand.get('last_name', '')} {cand.get('first_name', '')}"
        birth_date = cand.get('birth_date', '............')
        commune = cand.get('birth_place_commune', '............')
        wilaya  = _no_wnum(cand.get('birth_place_wilaya',  '............'))
        address = cand.get('current_address', '') or cand.get('birth_place_commune', '............')
        file_no = str(cand.get('id', '......'))
        lic_type = cand.get('license_type', 'B')
        exam_day = exam_date if exam_date else "........"

        if is_fr:
            txt_right(f"Le directeur de l'auto-école  {school_name}  sise à  {school_city}", 22.2, size=11)
            txt_right(f"atteste que M./Mme  {full_name}  né(e) le  {birth_date}", 21.2, size=11)
            txt_right(f"Commune de  {commune}    Wilaya de  {wilaya}", 20.2, size=11)
            txt_right(f"Adresse :  {address}", 19.2, size=11)
            txt_right((f"N° de dossier  {file_no}  inscrit(e) dans notre auto-école"
                       f" a réussi l'examen du permis de conduire catégorie  {lic_type}  le  {exam_day}"),
                      18.0, size=11)
            txt_right("La présente attestation est délivrée à l'intéressé(e) pour être présentée", 16.8, size=11)
            txt_right("au service du permis de conduire biométrique de la commune de résidence.", 15.9, size=11)
            txt_center("Cette attestation ne permet pas de conduire des véhicules.",
                       14.6, font=ARABIC_FONT_BOLD, size=12)
        else:
            line1 = f"يشهد السيد مدير مدرسة تعليم السياقة  {school_name}  التي مقرها ببلدية  {school_city}"
            txt_right(line1, 22.2, size=11)
            txt_right(f"أن السيد  {full_name}   المولود بتاريخ  {birth_date}  ...", 21.2, size=11)
            txt_right(f"بلدية  {commune}    ولاية  {wilaya}  ...", 20.2, size=11)
            txt_right(f"العنوان  {address}  ...", 19.2, size=11)
            line_exam = (f"رقم الملف  {file_no}  المسجل لدى مدرستنا قد اجتاز بنجاح"
                         f"  امتحان نيل رخصة السياقة صنف  {lic_type}  يوم  {exam_day}  ...")
            txt_right(line_exam, 18.0, size=11)
            txt_right("سلمة هذه الشهادة للمعني بالأمر من أجل تقديمها لمصلحة", 16.8, size=11)
            txt_right("رخصة السياقة البيمترية ببلدية الإقامة لسحب رخصة السياقة البيومترية", 15.9, size=11)
            txt_center("هذه الشهادة غير صالحة لقيادة المركبات",
                       14.6, font=ARABIC_FONT_BOLD, size=12)

        c.setLineWidth(0.5)
        c.line(2*cm, 14.0*cm, page_w - 2*cm, 14.0*cm)
        txt_center(_pdf_t("توقيع وختم", "Signature et cachet"), 13.2, font=ARABIC_FONT_BOLD, size=12)
        today_str = date.today().strftime('%Y-%m-%d')
        txt_right(_pdf_t(f"حُرّر بتاريخ:  {today_str}", f"Fait le :  {today_str}"), 7.5, size=10)

        c.save()
        self._trigger_print(path, T("doc_admin_cert"), default_name=default_name)

    def _doc_payment_receipt(self):
        if not self._check(): return
        cand = self._get_candidate()
        if not cand: return
        default_name = (f"recu_paiement_{cand['last_name']}.pdf" if LANG == "fr"
                        else f"وصل_دفع_{cand['last_name']}.pdf")
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/payment_receipt_{int(_dtt.now().timestamp())}.pdf"
        school = SchoolInfoDB.get()
        payments = PaymentDB.get_by_candidate(cand['id'])
        total_paid = sum(p['amount'] for p in payments)
        rem = cand['total_amount'] - total_paid

        doc = self._make_doc(path); s = _pdf_styles(); story = []
        if LANG == "fr":
            _pdf_header(story, school, "Reçu de Paiement")
            story.append(Paragraph(
                f"Candidat(e) : {cand.get('last_name','')} {cand.get('first_name','')}", s["h2"]))
            story.append(Paragraph(f"Téléphone : {cand.get('phone','')}", s["right"]))
            story.append(Spacer(1, 0.4*cm))
            rows = [["Observations", "Mode de paiement", "Montant (DA)", "Date", "N°"]]
            for i, p in enumerate(payments, 1):
                rows.append([p.get('notes','') or '-', _fr_val(p.get('payment_method','')),
                             f"{p['amount']:,.0f}", p.get('date',''), str(i)])
            story.append(_styled_table(rows, [4*cm, 3*cm, 3*cm, 3*cm, 1.5*cm]))
            story.append(Spacer(1, 0.6*cm))
            summary = [
                ["Désignation", "Montant"],
                ["Montant total de la formation",   f"{cand['total_amount']:,.0f} DA"],
                ["Total versé",                      f"{total_paid:,.0f} DA"],
                ["Reste à payer",                    f"{rem:,.0f} DA"],
            ]
            story.append(_styled_table(summary, [9*cm, 8*cm]))
            story.append(Spacer(1, 1*cm))
            story.append(Paragraph(f"Fait le : {date.today().strftime('%Y-%m-%d')}", s["right"]))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph("Cachet et signature du responsable : ___________________", s["right"]))
        else:
            _pdf_header(story, school, "وصل دفع")
            story.append(Paragraph(ar(f"المترشح: {cand.get('last_name','')} {cand.get('first_name','')}"), s["h2"]))
            story.append(Paragraph(ar(f"رقم الهاتف: {cand.get('phone','')}"), s["right"]))
            story.append(Spacer(1, 0.4*cm))
            rows = [["ملاحظة","طريقة الدفع","المبلغ (دج)","التاريخ","رقم"]]
            for i, p in enumerate(payments, 1):
                rows.append([p.get('notes','') or '-', p.get('payment_method',''),
                             f"{p['amount']:,.0f}", p.get('date',''), str(i)])
            story.append(_styled_table(rows, [4*cm, 3*cm, 3*cm, 3*cm, 1.5*cm]))
            story.append(Spacer(1, 0.6*cm))
            summary = [
                ["البند", "المبلغ"],
                ["المبلغ الإجمالي للتكوين", f"{cand['total_amount']:,.0f} دج"],
                ["مجموع المدفوعات",         f"{total_paid:,.0f} دج"],
                ["المبلغ المتبقي",          f"{rem:,.0f} دج"],
            ]
            story.append(_styled_table(summary, [9*cm, 8*cm]))
            story.append(Spacer(1, 1*cm))
            story.append(Paragraph(ar(f"حُرّر بتاريخ: {date.today().strftime('%Y-%m-%d')}"), s["right"]))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(ar("ختم وتوقيع المسؤول: ___________________"), s["right"]))
        doc.build(story)
        self._trigger_print(path, T("doc_payment_receipt"), default_name=default_name)

    def _doc_dispatch_table(self):
        """نافذة اختيار متعدد للمترشحين ثم توليد PDF جدول الإرسال."""
        if not self._check():
            return

        all_cands = CandidateDB.get_all()
        if not all_cands:
            show_error(T("doc_err_no_cands")); return

        school = SchoolInfoDB.get()
        addr = school.get('address', '')
        default_wilaya = school.get('wilaya', '').strip()

        # =========================================================
        #  نافذة الإعداد الحوارية
        # =========================================================
        dlg = tk.Toplevel(self)
        dlg.title(T("dispatch_dlg_title"))
        dlg.geometry("820x640")
        dlg.configure(bg=COLOR_BG)
        dlg.transient(self); dlg.grab_set()

        # --- رأس النافذة ---
        head = tk.Frame(dlg, bg=COLOR_PRIMARY, pady=14, padx=20)
        head.pack(fill="x")
        tk.Label(head, text=f"📋  {T('dispatch_dlg_head')}",
                 font=(FONT_FAMILY, 14, "bold"), bg=COLOR_PRIMARY, fg="white",
                 anchor=A()).pack(side=S())

        body = tk.Frame(dlg, bg=COLOR_BG)
        body.pack(fill="both", expand=True, padx=15, pady=10)

        # =========================================================
        #  العمود الأيمن: إعدادات الوثيقة
        # =========================================================
        right_col = tk.Frame(body, bg=COLOR_BG, width=240)
        right_col.pack(side="right", fill="y", padx=(10, 0))
        right_col.pack_propagate(False)

        ro, rc_frame = make_card(right_col)
        ro.pack(fill="both", expand=True)

        section_title(rc_frame, T("dispatch_doc_settings"), icon="⚙️")

        opts_vars = {}

        def lbl_entry(parent, label, key, default=""):
            tk.Label(parent, text=label, font=FONT_BOLD, bg=COLOR_CARD,
                     fg=COLOR_TEXT, anchor=A()).pack(fill="x", pady=(6, 1))
            v = tk.StringVar(value=default)
            opts_vars[key] = v
            make_entry(parent, v, width=26).pack(fill="x", ipady=4)

        def lbl_combobox(parent, label, key, default="", values=None):
            tk.Label(parent, text=label, font=FONT_BOLD, bg=COLOR_CARD,
                     fg=COLOR_TEXT, anchor=A()).pack(fill="x", pady=(6, 1))
            v = tk.StringVar(value=default)
            opts_vars[key] = v
            ttk.Combobox(parent, textvariable=v, values=values or [],
                         width=24, state="readonly").pack(fill="x", ipady=4)

        lbl_entry(rc_frame, T("dispatch_lbl_date"), "dispatch_date",
                  date.today().strftime("%d/%m/%Y"))
        lbl_entry(rc_frame, T("dispatch_lbl_record_no"), "record_number", "")
        lbl_combobox(rc_frame, T("dispatch_lbl_wilaya"), "wilaya",
                     default_wilaya, ALGERIA_WILAYAS)

        # --- ترتيب المترشحين ---
        tk.Label(rc_frame, text=T("dispatch_sort_title"), font=FONT_BOLD, bg=COLOR_CARD,
                 fg=COLOR_TEXT, anchor=A()).pack(fill="x", pady=(12, 4))
        sort_var = tk.StringVar(value="default")
        sort_options = [
            (T("dispatch_sort_default"), "default"),
            (T("dispatch_sort_alpha"),   "alpha"),
            (T("dispatch_sort_birth"),   "birth"),
            (T("dispatch_sort_reg"),     "reg"),
        ]
        for label, value in sort_options:
            tk.Radiobutton(
                rc_frame, text=label, variable=sort_var, value=value,
                font=FONT_SMALL, bg=COLOR_CARD, fg=COLOR_TEXT,
                selectcolor=COLOR_PRIMARY, activebackground=COLOR_CARD,
                anchor=A(), justify=J()
            ).pack(fill="x", pady=1)

        # =========================================================
        #  العمود الأيسر: قائمة المترشحين
        # =========================================================
        left_col = tk.Frame(body, bg=COLOR_BG)
        left_col.pack(side="left", fill="both", expand=True)

        # شريط البحث
        top_bar = tk.Frame(left_col, bg=COLOR_CARD, padx=8, pady=6)
        top_bar.pack(fill="x")
        tk.Label(top_bar, text=f"👥  {T('dispatch_choose_cands')}",
                 font=(FONT_FAMILY, 12, "bold"), bg=COLOR_CARD,
                 fg=COLOR_PRIMARY, anchor=A()).pack(fill="x")

        sv = tk.StringVar()
        sr = tk.Frame(top_bar, bg=COLOR_CARD); sr.pack(fill="x", pady=(4, 0))
        tk.Label(sr, text="🔍", bg=COLOR_CARD, fg=COLOR_PRIMARY,
                 font=(FONT_FAMILY, 11)).pack(side=S(), padx=(0, 4))
        make_entry(sr, sv, width=30).pack(side=S(), fill="x", expand=True, ipady=3)

        # أزرار تحديد / إلغاء الكل
        sel_row = tk.Frame(left_col, bg="#e0f2fe", padx=6, pady=5)
        sel_row.pack(fill="x")

        selected_set = set()

        def select_all():
            for c in all_cands:
                selected_set.add(c['id'])
            populate_tree(sv.get().strip())

        def deselect_all():
            selected_set.clear()
            populate_tree(sv.get().strip())

        tk.Button(sel_row, text=T("dispatch_select_all"), font=FONT_SMALL,
                  bg=COLOR_SUCCESS, fg="white", relief="flat", padx=10, pady=4,
                  cursor="hand2", command=select_all).pack(side=S(), padx=3)
        tk.Button(sel_row, text=T("dispatch_deselect_all"), font=FONT_SMALL,
                  bg="#94a3b8", fg="white", relief="flat", padx=10, pady=4,
                  cursor="hand2", command=deselect_all).pack(side=S(), padx=3)
        tk.Label(sel_row, text=T("dispatch_click_hint"),
                 font=FONT_TINY, bg="#e0f2fe", fg="#0369a1",
                 anchor=A()).pack(side=S(), padx=8)

        # Treeview
        tree_frame = tk.Frame(left_col, bg=COLOR_CARD)
        tree_frame.pack(fill="both", expand=True)

        cand_tree = ttk.Treeview(tree_frame,
                                  columns=("sel", "num", "name", "lic", "birth"),
                                  show="headings",
                                  style="Modern.Treeview",
                                  selectmode="browse")
        cand_tree.heading("sel",   text="✓",            anchor="center")
        cand_tree.heading("num",   text=T("dispatch_col_num"),   anchor="center")
        cand_tree.heading("name",  text=T("dispatch_col_name"),  anchor="center")
        cand_tree.heading("lic",   text=T("dispatch_col_lic"),   anchor="center")
        cand_tree.heading("birth", text=T("dispatch_col_birth"), anchor="center")
        cand_tree.column("sel",   width=35,  anchor="center", stretch=False)
        cand_tree.column("num",   width=45,  anchor="center", stretch=False)
        cand_tree.column("name",  width=220, anchor="center")
        cand_tree.column("lic",   width=55,  anchor="center", stretch=False)
        cand_tree.column("birth", width=110, anchor="center")

        vsb_c = ttk.Scrollbar(tree_frame, orient="vertical", command=cand_tree.yview)
        cand_tree.configure(yscrollcommand=vsb_c.set)
        vsb_c.pack(side="right", fill="y")
        cand_tree.pack(side="left", fill="both", expand=True)

        # إذا كان مترشح محدد مسبقاً في الصفحة — حدّده مبدئياً
        if self.selected_candidate_id:
            selected_set.add(self.selected_candidate_id)

        def populate_tree(filter_text=""):
            for item in cand_tree.get_children():
                cand_tree.delete(item)
            idx = 0
            for cand in all_cands:
                full = f"{cand['last_name']} {cand['first_name']}"
                if filter_text and filter_text.lower() not in full.lower() \
                        and filter_text not in cand.get('phone', ''):
                    continue
                iid = str(cand['id'])
                chk = "✓" if cand['id'] in selected_set else "○"
                tag = "sel" if cand['id'] in selected_set else ("even" if idx % 2 == 0 else "odd")
                cand_tree.insert("", "end", iid=iid, tags=(tag,),
                                 values=(chk, idx + 1, full,
                                         cand.get('license_type', 'B'),
                                         cand.get('birth_date', '')))
                idx += 1
            cand_tree.tag_configure("sel",  background="#bfdbfe", foreground="#1e3a8a")
            cand_tree.tag_configure("even", background="#f8fafc",  foreground=COLOR_TEXT)
            cand_tree.tag_configure("odd",  background=COLOR_CARD, foreground=COLOR_TEXT)

        populate_tree()

        def toggle_item(event):
            item = cand_tree.identify_row(event.y)
            if not item:
                return
            cid = int(item)
            if cid in selected_set:
                selected_set.discard(cid)
            else:
                selected_set.add(cid)
            populate_tree(sv.get().strip())

        cand_tree.bind("<Button-1>", toggle_item)
        sv.trace("w", lambda *a: populate_tree(sv.get().strip()))

        # =========================================================
        #  شريط الأزرار السفلي
        # =========================================================
        bf = tk.Frame(dlg, bg=COLOR_BG, pady=12)
        bf.pack(side="bottom", fill="x", padx=20)
        ModernButton(bf, T("btn_cancel"), dlg.destroy, icon="✗",
                     color=COLOR_TEXT_LIGHT).pack(side=So(), padx=5)


        def do_generate():
            if not selected_set:
                show_error(T("doc_err_sel_one")); return

            selected_cands = [c for c in all_cands if c['id'] in selected_set]

            order = sort_var.get()
            if order == "alpha":
                selected_cands = sorted(
                    selected_cands,
                    key=lambda c: (c.get('last_name', '') + ' ' + c.get('first_name', '')).strip().lower()
                )
            elif order == "birth":
                def _birth_key(c):
                    bd = (c.get('birth_date', '') or '').strip()
                    try:
                        parts = bd.replace('/', '-').split('-')
                        if len(parts) == 3:
                            y, m, d = (int(parts[0]), int(parts[1]), int(parts[2])) \
                                if len(parts[0]) == 4 \
                                else (int(parts[2]), int(parts[1]), int(parts[0]))
                            return (y, m, d,
                                    c.get('last_name', '').lower(),
                                    c.get('first_name', '').lower(),
                                    c.get('id', 0))
                    except (ValueError, IndexError):
                        pass
                    return (9999, 12, 31,
                            c.get('last_name', '').lower(),
                            c.get('first_name', '').lower(),
                            c.get('id', 0))
                selected_cands = sorted(selected_cands, key=_birth_key)
            elif order == "reg":
                def _reg_key(c):
                    rd = (c.get('registration_date', '') or '').strip()
                    try:
                        parts = rd.replace('/', '-').split('-')
                        if len(parts) == 3:
                            y, m, d = (int(parts[0]), int(parts[1]), int(parts[2])) \
                                if len(parts[0]) == 4 \
                                else (int(parts[2]), int(parts[1]), int(parts[0]))
                            return (y, m, d,
                                    c.get('last_name', '').lower(),
                                    c.get('first_name', '').lower(),
                                    c.get('id', 0))
                    except (ValueError, IndexError):
                        pass
                    return (9999, 12, 31,
                            c.get('last_name', '').lower(),
                            c.get('first_name', '').lower(),
                            c.get('id', 0))
                selected_cands = sorted(selected_cands, key=_reg_key)

            settings = {
                "dispatch_date":  opts_vars["dispatch_date"].get().strip()
                                  or date.today().strftime("%d/%m/%Y"),
                "record_number":  opts_vars["record_number"].get().strip(),
                "wilaya":         opts_vars["wilaya"].get().strip() or ".......",
            }

            date_slug = settings['dispatch_date'].replace('/','_')
            default_dispatch = (f"tableau_envoi_{date_slug}.pdf" if LANG == "fr"
                                else f"جدول_الإرسال_{date_slug}.pdf")
            import tempfile as _tf; from datetime import datetime as _dtt
            path = _tf.gettempdir() + f"/dispatch_{int(_dtt.now().timestamp())}.pdf"
            dlg.destroy()
            self._generate_dispatch_table_pdf(path, selected_cands, settings,
                                              default_name=default_dispatch)

        ModernButton(bf, T("dispatch_gen_pdf"), do_generate,
                     icon="📄", color=COLOR_PRIMARY).pack(side=S(), padx=5)

    def _generate_dispatch_table_pdf(self, path, cands, settings, direct_print=False, default_name=None):
        """يُنتج PDF جدول إرسال يضم قائمة المترشحين المحددين."""
        school = SchoolInfoDB.get()
        wilaya = settings.get("wilaya", ".........")
        _raw_date = settings.get("dispatch_date", date.today().strftime("%d/%m/%Y"))
        # تطبيع الصيغة: قبول DD/MM/YYYY أو YYYY-MM-DD → YYYY/MM/DD
        def _norm_date(d):
            for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d"):
                try:
                    from datetime import datetime as _dt
                    return _dt.strptime(d, fmt).strftime("%Y/%m/%d")
                except ValueError:
                    pass
            return d
        dispatch_date = _norm_date(_raw_date)
        record_number = settings.get("record_number", "")
        is_fr = LANG == "fr"

        doc = self._make_doc(path)
        s = _pdf_styles()
        story = []

        if is_fr:
            _wil_fr = _strip_wilaya_num(wilaya)
            story.append(Paragraph("République Algérienne Démocratique et Populaire", s["center"]))
            story.append(Spacer(1, 0.3*cm))
            story.append(Paragraph("Ministère de l'Intérieur, des Collectivités Locales et de l'Aménagement du Territoire", s["center"]))
            story.append(Paragraph("Délégation Nationale à la Sécurité Routière", s["center"]))
            story.append(Paragraph(f"Délégation de Wilaya à la Sécurité Routière - Wilaya de {_wil_fr}", s["center"]))
            if record_number:
                story.append(Spacer(1, 0.4*cm))
                story.append(Paragraph(f"N° du procès-verbal : {record_number}", s["right"]))
            story.append(Spacer(1, 1.0*cm))
            story.append(Paragraph(f"{_wil_fr}, le : {dispatch_date}", s["right"]))
            story.append(Spacer(1, 0.4*cm))
            story.append(Paragraph(f"<u><b>Tableau d'envoi</b></u>", s["title"]))
            story.append(Spacer(1, 0.6*cm))
            rows = [["Nom et Prénom", "Date de naissance", "Catégorie", "Observations"]]
            for c in cands:
                bd = c.get('birth_date', '').replace('-', '/')
                rows.append([f"{c.get('last_name','')} {c.get('first_name','')}",
                             bd,
                             c.get('license_type', ''),
                             ""])
            stamp_txt = "Cachet et signature de l'auto-école"
            col_widths_tbl = [7.5*cm, 3.5*cm, 2.5*cm, 3*cm]
        else:
            _wil_ar = _strip_wilaya_num(wilaya)
            story.append(Paragraph(ar("الجمهورية الجزائرية الديمقراطية الشعبية"), s["center"]))
            story.append(Spacer(1, 0.3*cm))
            story.append(Paragraph(ar("وزارة الداخلية والجماعات المحلية والتهيئة العمرانية"), s["center"]))
            story.append(Paragraph(ar("المندوبية الوطنية للأمن في الطرق"), s["center"]))
            story.append(Paragraph(ar(f"المندوبية الولائية للأمن في الطرق لولاية {_wil_ar}"), s["center"]))
            if record_number:
                story.append(Spacer(1, 0.4*cm))
                story.append(Paragraph(ar(f"رقم المحضر: {record_number}"), s["right"]))
            story.append(Spacer(1, 1.0*cm))
            story.append(Paragraph(ar(f"{_wil_ar} يوم: {dispatch_date}"), s["right"]))
            story.append(Spacer(1, 0.4*cm))
            story.append(Paragraph(f"<u><b>{ar('جدول الارسال')}</b></u>", s["title"]))
            story.append(Spacer(1, 0.6*cm))
            rows = [["الملاحظة", "الصنف", "تاريخ الميلاد", "الاسم و اللقب"]]
            for c in cands:
                bd = c.get('birth_date', '').replace('-', '/')
                rows.append(["",
                             _ar_lic_code(c.get('license_type', '')),
                             bd,
                             f"{c.get('last_name','')} {c.get('first_name','')}"])
            stamp_txt = "ختم وتوقيع مدرسة تعليم السياقة"
            col_widths_tbl = [3*cm, 2.5*cm, 3.5*cm, 7.5*cm]

        processed = [[_ptxt(cell) for cell in row] for row in rows]
        tbl = Table(processed, colWidths=col_widths_tbl)
        tbl.setStyle(TableStyle([
            ('FONTNAME',    (0, 0), (-1, -1), ARABIC_FONT),
            ('FONTNAME',    (0, 0), (-1,  0), ARABIC_FONT_BOLD),
            ('GRID',        (0, 0), (-1, -1), 0.8, colors.black),
            ('ALIGN',       (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTSIZE',    (0, 0), (-1, -1), 12),
            ('TOPPADDING',  (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('BACKGROUND',  (0, 0), (-1,  0), colors.HexColor("#DBEAFE")),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 1.5*cm))
        story.append(Paragraph(_ptxt(stamp_txt), s["center"]))
        story.append(Spacer(1, 2*cm))
        story.append(Paragraph("___________________________", s["center"]))

        doc.build(story)
        self._trigger_print(path, T("doc_dispatch"), default_name=default_name)

    # --- وثائق جماعية ---------------------------------------------------------

    def _doc_candidates_list(self):
        if not self._check(): return
        dr = self._ask_date_range_for_doc()
        if dr is None: return
        d_from, d_to = dr
        default_name = "liste_candidats.pdf" if LANG == "fr" else "قائمة_المترشحين.pdf"
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/candidates_list_{int(_dtt.now().timestamp())}.pdf"
        school = SchoolInfoDB.get()
        cands = CandidateDB.get_by_date_range(d_from, d_to)
        if LANG == "fr":
            period_txt = (f"Période : {d_from or '—'}  →  {d_to or '—'}"
                          if (d_from or d_to) else "Toutes les périodes")
        else:
            period_txt = (f"الفترة: {d_from or '—'}  →  {d_to or '—'}"
                          if (d_from or d_to) else "كل الفترات")
        doc = self._make_doc(path, rightMargin=1.5*cm, leftMargin=1.5*cm,
                             pagesize=A4); s = _pdf_styles(); story = []
        if LANG == "fr":
            _pdf_header(story, school, "Liste des Candidats")
            story.append(Paragraph(period_txt, s["right"]))
            story.append(Spacer(1, 0.3*cm))
            rows = [["Téléphone", "Type de permis", "Sexe", "Date d'inscription", "Nom complet", "N°"]]
            for i, c in enumerate(cands, 1):
                rows.append([c.get('phone',''), c.get('license_type',''),
                             _fr_val(c.get('gender','')), c.get('registration_date',''),
                             f"{c.get('last_name','')} {c.get('first_name','')}", str(i)])
            story.append(_styled_table(rows, [3.5*cm, 2.5*cm, 1.8*cm, 3*cm, 5.5*cm, 1.2*cm]))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(f"Total : {len(cands)} candidat(s)", s["h2"]))
        else:
            _pdf_header(story, school, "قائمة المترشحين")
            story.append(Paragraph(ar(period_txt), s["right"]))
            story.append(Spacer(1, 0.3*cm))
            rows = [["رقم الهاتف","نوع الرخصة","الجنس","تاريخ التسجيل","الاسم الكامل","رقم"]]
            for i, c in enumerate(cands, 1):
                rows.append([c.get('phone',''), c.get('license_type',''),
                             c.get('gender',''), c.get('registration_date',''),
                             f"{c.get('last_name','')} {c.get('first_name','')}", str(i)])
            story.append(_styled_table(rows, [3.5*cm, 2.5*cm, 1.8*cm, 3*cm, 5.5*cm, 1.2*cm]))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(ar(f"المجموع: {len(cands)} مترشح"), s["h2"]))
        doc.build(story)
        self._trigger_print(path, T("doc_cand_list"), default_name=default_name)

    def _doc_instructors_list(self):
        if not self._check(): return
        default_name = "liste_moniteurs.pdf" if LANG == "fr" else "قائمة_الممرنين.pdf"
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/instructors_list_{int(_dtt.now().timestamp())}.pdf"
        school = SchoolInfoDB.get()
        instructors = InstructorDB.get_all()
        doc = self._make_doc(path); s = _pdf_styles(); story = []
        if LANG == "fr":
            _pdf_header(story, school, "Liste des Moniteurs")
            rows = [["Années d'exp.", "Catégories", "Téléphone", "Sexe", "Nom complet", "N°"]]
            for i, ins in enumerate(instructors, 1):
                rows.append([str(ins.get('experience_years','')), ins.get('categories',''),
                             ins.get('phone',''), _fr_val(ins.get('gender','')),
                             f"{ins.get('last_name','')} {ins.get('first_name','')}", str(i)])
            story.append(_styled_table(rows, [2.5*cm, 2.5*cm, 3*cm, 2*cm, 5.5*cm, 1.5*cm]))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(f"Total : {len(instructors)} moniteur(s)", s["h2"]))
        else:
            _pdf_header(story, school, "قائمة الممرنين")
            rows = [["سنوات الخبرة","الأصناف","الهاتف","الجنس","الاسم الكامل","رقم"]]
            for i, ins in enumerate(instructors, 1):
                rows.append([str(ins.get('experience_years','')), ins.get('categories',''),
                             ins.get('phone',''), ins.get('gender',''),
                             f"{ins.get('last_name','')} {ins.get('first_name','')}", str(i)])
            story.append(_styled_table(rows, [2.5*cm, 2.5*cm, 3*cm, 2*cm, 5.5*cm, 1.5*cm]))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(ar(f"المجموع: {len(instructors)} ممرن"), s["h2"]))
        doc.build(story)
        self._trigger_print(path, T("doc_inst_list"), default_name=default_name)

    def _doc_expenses_report(self):
        if not self._check(): return
        dr = self._ask_date_range_for_doc()
        if dr is None: return
        d_from, d_to = dr
        default_name = "rapport_depenses.pdf" if LANG == "fr" else "تقرير_المصاريف.pdf"
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/expenses_{int(_dtt.now().timestamp())}.pdf"
        school = SchoolInfoDB.get()
        expenses = ExpenseDB.get_all_in_range(d_from, d_to)
        if LANG == "fr":
            period_txt = (f"Période : {d_from or '—'}  →  {d_to or '—'}"
                          if (d_from or d_to) else "Toutes les périodes")
        else:
            period_txt = (f"الفترة: {d_from or '—'}  →  {d_to or '—'}"
                          if (d_from or d_to) else "كل الفترات")
        doc = self._make_doc(path); s = _pdf_styles(); story = []
        total = 0
        if LANG == "fr":
            _pdf_header(story, school, "Rapport des Dépenses")
            story.append(Paragraph(period_txt, s["right"]))
            story.append(Spacer(1, 0.3*cm))
            rows = [["Observations", "Montant (DA)", "Date", "Type de dépense", "N°"]]
            for i, e in enumerate(expenses, 1):
                total += e['amount']
                rows.append([e.get('notes','') or '-', f"{e['amount']:,.0f}",
                             e.get('date',''), e.get('expense_type',''), str(i)])
            story.append(_styled_table(rows, [4.5*cm, 3*cm, 3*cm, 4*cm, 1.5*cm]))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(f"Total des dépenses : {total:,.0f} DA", s["h2"]))
        else:
            _pdf_header(story, school, "تقرير المصاريف")
            story.append(Paragraph(ar(period_txt), s["right"]))
            story.append(Spacer(1, 0.3*cm))
            rows = [["ملاحظة","المبلغ (دج)","التاريخ","نوع المصروف","رقم"]]
            for i, e in enumerate(expenses, 1):
                total += e['amount']
                rows.append([e.get('notes','') or '-', f"{e['amount']:,.0f}",
                             e.get('date',''), e.get('expense_type',''), str(i)])
            story.append(_styled_table(rows, [4.5*cm, 3*cm, 3*cm, 4*cm, 1.5*cm]))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(ar(f"المجموع الكلي للمصاريف: {total:,.0f} دج"), s["h2"]))
        doc.build(story)
        self._trigger_print(path, T("doc_expenses"), default_name=default_name)

    def _doc_payments_report(self):
        if not self._check(): return
        dr = self._ask_date_range_for_doc()
        if dr is None: return
        d_from, d_to = dr
        default_name = "rapport_paiements.pdf" if LANG == "fr" else "تقرير_المدفوعات.pdf"
        import tempfile as _tf; from datetime import datetime as _dtt
        path = _tf.gettempdir() + f"/payments_{int(_dtt.now().timestamp())}.pdf"
        school = SchoolInfoDB.get()
        paid_map = PaymentDB.get_paid_per_candidate_in_range(d_from, d_to)
        if LANG == "fr":
            period_txt = (f"Période : {d_from or '—'}  →  {d_to or '—'}"
                          if (d_from or d_to) else "Toutes les périodes")
        else:
            period_txt = (f"الفترة: {d_from or '—'}  →  {d_to or '—'}"
                          if (d_from or d_to) else "كل الفترات")
        doc = self._make_doc(path); s = _pdf_styles(); story = []
        paid_global = 0; total_global = 0; i = 0
        if LANG == "fr":
            _pdf_header(story, school, "Rapport des Paiements")
            story.append(Paragraph(period_txt, s["right"]))
            story.append(Spacer(1, 0.3*cm))
            rows = [["Versé dans la période", "Total convenu", "Nom complet", "N°"]]
            for cid, paid in paid_map.items():
                c = CandidateDB.get(cid)
                if not c: continue
                i += 1
                paid_global += paid
                total_global += c.get('total_amount', 0)
                rows.append([f"{paid:,.0f}", f"{c.get('total_amount',0):,.0f}",
                             f"{c.get('last_name','')} {c.get('first_name','')}", str(i)])
            story.append(_styled_table(rows, [3.5*cm, 3.5*cm, 6.5*cm, 1.5*cm]))
            story.append(Spacer(1, 0.5*cm))
            summary = [["Désignation", "Montant"],
                       ["Total des paiements dans la période", f"{paid_global:,.0f} DA"],
                       ["Montant total convenu",               f"{total_global:,.0f} DA"]]
            story.append(_styled_table(summary, [9*cm, 8*cm]))
        else:
            _pdf_header(story, school, "تقرير المدفوعات")
            story.append(Paragraph(ar(period_txt), s["right"]))
            story.append(Spacer(1, 0.3*cm))
            rows = [["المدفوع في الفترة","الإجمالي المتفق عليه","الاسم الكامل","رقم"]]
            for cid, paid in paid_map.items():
                c = CandidateDB.get(cid)
                if not c: continue
                i += 1
                paid_global += paid
                total_global += c.get('total_amount', 0)
                rows.append([f"{paid:,.0f}", f"{c.get('total_amount',0):,.0f}",
                             f"{c.get('last_name','')} {c.get('first_name','')}", str(i)])
            story.append(_styled_table(rows, [3.5*cm, 3.5*cm, 6.5*cm, 1.5*cm]))
            story.append(Spacer(1, 0.5*cm))
            summary = [["البند", "المبلغ"],
                       ["إجمالي المدفوعات في الفترة", f"{paid_global:,.0f} دج"],
                       ["المبلغ الإجمالي المتفق عليه", f"{total_global:,.0f} دج"]]
            story.append(_styled_table(summary, [9*cm, 8*cm]))
        doc.build(story)
        self._trigger_print(path, T("doc_payments_report"), default_name=default_name)


    def _doc_exam_candidates_list(self):
        """وثيقة: قائمة المترشحين لنيل رخصة السياقة - مع نافذة اختيار متقدمة."""
        if not self._check():
            return

        all_cands = CandidateDB.get_all()
        if not all_cands:
            show_error(T("doc_err_no_cands")); return

        school = SchoolInfoDB.get()

        # ── بناء قاموس الممرنين (عنوان فريد → id) ──────────────────────────
        _all_instructors = InstructorDB.get_all()
        _all_lbl = _pdf_t("الكل", "Tous")
        inst_map = {_all_lbl: None}
        _seen_inst_names = {}
        for _ins in _all_instructors:
            _base = f"{_ins['last_name']} {_ins['first_name']}"
            if _base in _seen_inst_names:
                _base = f"{_base} ({_ins['id']})"
            _seen_inst_names[_base] = True
            inst_map[_base] = _ins['id']
        inst_names = list(inst_map.keys())

        # ========== نافذة الإعداد ==========
        dlg = tk.Toplevel(self)
        dlg.title(T("examlist_dlg_title"))
        dlg.geometry("820x680")
        dlg.configure(bg=COLOR_BG)
        dlg.transient(self); dlg.grab_set()

        # --- رأس النافذة ---
        head = tk.Frame(dlg, bg="#0369a1", pady=14, padx=20)
        head.pack(fill="x")
        tk.Label(head, text=f"📋  {T('examlist_dlg_head')}",
                 font=(FONT_FAMILY, 14, "bold"), bg="#0369a1", fg="white",
                 anchor=A()).pack(side=S())

        body = tk.Frame(dlg, bg=COLOR_BG); body.pack(fill="both", expand=True, padx=15, pady=10)

        # --- يمين: إعدادات الوثيقة ---
        right_col = tk.Frame(body, bg=COLOR_BG, width=240)
        right_col.pack(side="right", fill="y", padx=(10, 0))
        right_col.pack_propagate(False)

        ro, rc_frame = make_card(right_col)
        ro.pack(fill="both", expand=True)

        section_title(rc_frame, T("examlist_exam_data"), icon="🗓️")

        opts_vars = {}

        def lbl_entry(parent, label, key, default=""):
            tk.Label(parent, text=label, font=FONT_BOLD, bg=COLOR_CARD,
                     fg=COLOR_TEXT, anchor=A()).pack(fill="x", pady=(6, 1))
            v = tk.StringVar(value=default)
            opts_vars[key] = v
            make_entry(parent, v, width=26).pack(fill="x", ipady=4)

        def lbl_combobox(parent, label, key, default="", values=None):
            tk.Label(parent, text=label, font=FONT_BOLD, bg=COLOR_CARD,
                     fg=COLOR_TEXT, anchor=A()).pack(fill="x", pady=(6, 1))
            v = tk.StringVar(value=default)
            opts_vars[key] = v
            ttk.Combobox(parent, textvariable=v, values=values or [],
                         width=24, state="readonly").pack(fill="x", ipady=4)

        lbl_entry(rc_frame, T("examlist_exam_date"), "exam_date",
                  date.today().strftime("%d/%m/%Y"))
        lbl_entry(rc_frame, T("examlist_exam_center"), "exam_center", "")
        lbl_entry(rc_frame, T("examlist_doc_ref"), "doc_ref", "")
        lbl_entry(rc_frame, _pdf_t("ر.ب.ت", "B.R.T"), "training_card_num", "")

        # قائمة المركبات — ن.م
        _vehs = VehicleDB.get_all()
        _vehs_filtered = [v for v in _vehs if v.get('plate_number', '')]
        _veh_labels = [""] + [f"{v.get('model', '')} — {v.get('plate_number', '')}"
                               for v in _vehs_filtered]
        lbl_combobox(rc_frame, _pdf_t("ن.م (نوع المركبة)", "N.V. (Type véhicule)"),
                     "vehicle_nm", "", _veh_labels)

        _veh_map = {f"{v.get('model', '')} — {v.get('plate_number', '')}": v
                    for v in _vehs_filtered}

        def _on_vehicle_select(*_):
            lbl = opts_vars["vehicle_nm"].get()
            veh = _veh_map.get(lbl)
            if veh:
                opts_vars["doc_ref"].set(veh.get("plate_number", ""))
                opts_vars["training_card_num"].set(veh.get("training_card_number", ""))
            else:
                opts_vars["doc_ref"].set("")
                opts_vars["training_card_num"].set("")
        opts_vars["vehicle_nm"].trace_add("write", _on_vehicle_select)

        # حقل الممرن لرأس الـ PDF (مستقل عن فلتر الممرن)
        _inst_names_only = [n for n in inst_names if n != _all_lbl]
        lbl_combobox(rc_frame, _pdf_t("ممرن", "Moniteur"),
                     "instructor_nm", "", [""] + _inst_names_only)

        def _on_inst_filter_for_header(*_):
            sel = inst_filter_var.get()
            if sel == _all_lbl:
                opts_vars["instructor_nm"].set("")
            else:
                opts_vars["instructor_nm"].set(sel)

        lbl_combobox(rc_frame, T("examlist_wilaya"), "wilaya",
                     school.get('wilaya', '').strip(),
                     ALGERIA_WILAYAS)

        tk.Frame(rc_frame, bg=COLOR_BORDER, height=1).pack(fill="x", pady=10)
        section_title(rc_frame, T("examlist_nature"), icon="📝")

        stage_var = tk.StringVar(value="all")
        stages_opts = [
            (T("examlist_all_types"), "all"),
            (T("examlist_code"),      "code"),
            (T("examlist_creneau"),   "creneau"),
            (T("examlist_circuit"),   "circuit"),
        ]
        for txt, val in stages_opts:
            tk.Radiobutton(rc_frame, text=txt, variable=stage_var, value=val,
                           font=FONT_MAIN, bg=COLOR_CARD, fg=COLOR_TEXT,
                           activebackground=COLOR_CARD,
                           selectcolor=COLOR_PRIMARY_LIGHT,
                           anchor=A(), justify=J()).pack(fill="x", pady=2)

        # --- يسار: قائمة المترشحين ---
        left_col = tk.Frame(body, bg=COLOR_BG)
        left_col.pack(side="left", fill="both", expand=True)

        # عنوان + شريط بحث
        top_bar = tk.Frame(left_col, bg=COLOR_CARD, padx=8, pady=6,
                           relief="flat", bd=0)
        top_bar.pack(fill="x")

        tk.Label(top_bar, text=f"👥  {T('dispatch_choose_cands')}",
                 font=(FONT_FAMILY, 12, "bold"), bg=COLOR_CARD,
                 fg=COLOR_PRIMARY, anchor=A()).pack(fill="x")

        sv = tk.StringVar()
        sr = tk.Frame(top_bar, bg=COLOR_CARD); sr.pack(fill="x", pady=(4, 0))
        tk.Label(sr, text="🔍", bg=COLOR_CARD, fg=COLOR_PRIMARY,
                 font=(FONT_FAMILY, 11)).pack(side=S(), padx=(0, 4))
        make_entry(sr, sv, width=30).pack(side=S(), fill="x", expand=True, ipady=3)

        # ── فلاتر الصنف ──────────────────────────────────────────────────────
        _A_GROUP = {"A", "A1"}

        def _norm_cat(lic):
            """يُعيد 'A/A1' إذا كان الصنف A أو A1، وإلا يُعيد الصنف كما هو."""
            v = (lic or "").strip()
            return "A/A1" if v in _A_GROUP else v

        _raw_cats = {(c.get('license_type') or 'ب').strip() for c in all_cands}
        all_cats = sorted({_norm_cat(cat) for cat in _raw_cats})
        cat_filter = tk.StringVar(value="all")   # "all" أو اسم صنف محدد

        cat_bar = tk.Frame(left_col, bg="#f0f9ff", padx=6, pady=4)
        cat_bar.pack(fill="x")
        tk.Label(cat_bar,
                 text=_pdf_t("فلترة حسب الصنف:", "Filtrer par catégorie :"),
                 font=FONT_SMALL, bg="#f0f9ff", fg="#0369a1",
                 anchor=A()).pack(side=S(), padx=(0, 6))

        def _cat_btn(parent, label, value, color="#64748b"):
            def _on():
                cat_filter.set(value)
                if value == "all":
                    for cand in all_cands:
                        selected_set.add(cand['id'])
                else:
                    selected_set.clear()
                    for cand in all_cands:
                        if _norm_cat((cand.get('license_type') or 'ب').strip()) == value:
                            selected_set.add(cand['id'])
                _refresh_cat_buttons()
                populate_tree(sv.get().strip())
            b = tk.Button(parent, text=label, font=FONT_SMALL,
                          bg=color, fg="white", relief="flat",
                          padx=8, pady=3, cursor="hand2", command=_on)
            b.pack(side=S(), padx=2)
            return b

        cat_buttons = {}
        cat_buttons["all"] = _cat_btn(cat_bar,
                                       _pdf_t("الكل", "Tous"), "all", "#0369a1")
        for cat in all_cats:
            cat_buttons[cat] = _cat_btn(cat_bar, cat, cat, "#7c3aed")

        def _refresh_cat_buttons():
            active = cat_filter.get()
            for key, btn in cat_buttons.items():
                if key == active:
                    btn.configure(relief="sunken", bd=2)
                else:
                    btn.configure(relief="flat", bd=0)
        _refresh_cat_buttons()

        # ── فلتر الممرن ───────────────────────────────────────────────────────
        inst_filter_var = tk.StringVar(value=inst_names[0])
        inst_bar = tk.Frame(left_col, bg="#f0fdf4", padx=6, pady=4)
        inst_bar.pack(fill="x")
        tk.Label(inst_bar,
                 text=_pdf_t("فلترة حسب الممرن:", "Filtrer par moniteur :"),
                 font=FONT_SMALL, bg="#f0fdf4", fg="#15803d",
                 anchor=A()).pack(side=S(), padx=(0, 6))
        ttk.Combobox(inst_bar, textvariable=inst_filter_var,
                     values=inst_names, state="readonly",
                     width=24).pack(side=S(), padx=4)
        inst_filter_var.trace_add("write", _on_inst_filter_for_header)

        # ── أزرار تحديد الكل / إلغاء الكل (للصنف الظاهر حالياً) ─────────────
        sel_row = tk.Frame(left_col, bg="#e0f2fe", padx=6, pady=5)
        sel_row.pack(fill="x")

        # مجموعة iids المحددة
        selected_set = set()

        def _visible_cands():
            """يُعيد قائمة المترشحين المطابقين للفلاتر (نص + صنف + ممرن)."""
            txt = sv.get().strip()
            act_cat = cat_filter.get()
            act_inst_id = inst_map.get(inst_filter_var.get())
            result = []
            for cand in all_cands:
                if act_cat != "all" and _norm_cat((cand.get('license_type') or 'ب').strip()) != act_cat:
                    continue
                if act_inst_id is not None and cand.get('instructor_id') != act_inst_id:
                    continue
                full = f"{cand['last_name']} {cand['first_name']}"
                if txt and txt.lower() not in full.lower() \
                        and txt not in cand.get('phone', ''):
                    continue
                result.append(cand)
            return result

        def select_all():
            for cand in _visible_cands():
                selected_set.add(cand['id'])
            populate_tree(sv.get().strip())

        def deselect_all():
            for cand in _visible_cands():
                selected_set.discard(cand['id'])
            populate_tree(sv.get().strip())

        tk.Button(sel_row, text=T("dispatch_select_all"), font=FONT_SMALL,
                  bg=COLOR_SUCCESS, fg="white", relief="flat", padx=10, pady=4,
                  cursor="hand2", command=select_all).pack(side=S(), padx=3)
        tk.Button(sel_row, text=T("dispatch_deselect_all"), font=FONT_SMALL,
                  bg="#94a3b8", fg="white", relief="flat", padx=10, pady=4,
                  cursor="hand2", command=deselect_all).pack(side=S(), padx=3)
        tk.Label(sel_row,
                 text=T("dispatch_click_hint"),
                 font=FONT_TINY, bg="#e0f2fe", fg="#0369a1",
                 anchor=A()).pack(side=S(), padx=8)

        # حاوية الجدول
        tree_frame = tk.Frame(left_col, bg=COLOR_CARD)
        tree_frame.pack(fill="both", expand=True)

        # Treeview مع عمود ✓ للتحديد
        cand_tree = ttk.Treeview(tree_frame,
                                 columns=("sel", "num", "name", "lic", "birth"),
                                 show="headings",
                                 style="Modern.Treeview",
                                 selectmode="browse")
        cand_tree.heading("sel",   text="✓",             anchor="center")
        cand_tree.heading("num",   text=T("dispatch_col_num"),   anchor="center")
        cand_tree.heading("name",  text=T("dispatch_col_name"),  anchor="center")
        cand_tree.heading("lic",   text=T("dispatch_col_lic"),   anchor="center")
        cand_tree.heading("birth", text=T("dispatch_col_birth"), anchor="center")
        cand_tree.column("sel",   width=35,  anchor="center", stretch=False)
        cand_tree.column("num",   width=45,  anchor="center", stretch=False)
        cand_tree.column("name",  width=220, anchor="center")
        cand_tree.column("lic",   width=55,  anchor="center", stretch=False)
        cand_tree.column("birth", width=110, anchor="center")

        vsb_c = ttk.Scrollbar(tree_frame, orient="vertical", command=cand_tree.yview)
        cand_tree.configure(yscrollcommand=vsb_c.set)
        vsb_c.pack(side="right", fill="y")
        cand_tree.pack(side="left", fill="both", expand=True)

        # تحديد الكل مبدئياً
        for c in all_cands:
            selected_set.add(c['id'])

        def populate_tree(filter_text=""):
            for item in cand_tree.get_children():
                cand_tree.delete(item)
            act_cat = cat_filter.get()
            act_inst_id = inst_map.get(inst_filter_var.get())
            idx = 0
            for cand in all_cands:
                # فلترة الصنف
                if act_cat != "all" and \
                        _norm_cat((cand.get('license_type') or 'ب').strip()) != act_cat:
                    continue
                # فلترة الممرن
                if act_inst_id is not None and cand.get('instructor_id') != act_inst_id:
                    continue
                # فلترة النص
                full = f"{cand['last_name']} {cand['first_name']}"
                if filter_text and filter_text.lower() not in full.lower() \
                        and filter_text not in cand.get('phone', ''):
                    continue
                iid = str(cand['id'])
                chk = "✓" if cand['id'] in selected_set else "○"
                tag = "sel" if cand['id'] in selected_set else ("even" if idx % 2 == 0 else "odd")
                cand_tree.insert("", "end", iid=iid, tags=(tag,),
                                 values=(chk, idx + 1, full,
                                         cand.get('license_type', 'B'),
                                         cand.get('birth_date', '')))
                idx += 1
            cand_tree.tag_configure("sel",  background="#bfdbfe", foreground="#1e3a8a")
            cand_tree.tag_configure("even", background="#f8fafc",  foreground=COLOR_TEXT)
            cand_tree.tag_configure("odd",  background=COLOR_CARD, foreground=COLOR_TEXT)

        populate_tree()

        def toggle_item(event):
            item = cand_tree.identify_row(event.y)
            if not item:
                return
            cid = int(item)
            if cid in selected_set:
                selected_set.discard(cid)
            else:
                selected_set.add(cid)
            populate_tree(sv.get().strip())

        cand_tree.bind("<Button-1>", toggle_item)
        sv.trace("w", lambda *a: populate_tree(sv.get().strip()))

        def _on_inst_filter(*_):
            act_inst_id = inst_map.get(inst_filter_var.get())
            if act_inst_id is None:
                for cand in all_cands:
                    selected_set.add(cand['id'])
            else:
                selected_set.clear()
                for cand in all_cands:
                    if cand.get('instructor_id') == act_inst_id:
                        selected_set.add(cand['id'])
            populate_tree(sv.get().strip())

        inst_filter_var.trace("w", _on_inst_filter)

        # --- شريط الأزرار السفلي ---
        bf = tk.Frame(dlg, bg=COLOR_BG, pady=12); bf.pack(side="bottom", fill="x", padx=20)
        ModernButton(bf, T("btn_cancel"), dlg.destroy, icon="✗",
                     color=COLOR_TEXT_LIGHT).pack(side=So(), padx=5)

        def do_generate():
            act_cat = cat_filter.get()
            if act_cat == "all":
                selected_cands = list(all_cands)
            else:
                selected_ids = list(selected_set)
                if not selected_ids:
                    show_error(T("doc_err_sel_one")); return
                selected_cands = [c for c in all_cands
                                  if c['id'] in selected_ids
                                  and _norm_cat((c.get('license_type') or 'ب').strip()) == act_cat]
                if not selected_cands:
                    show_error(T("doc_err_sel_one")); return
            exam_date  = opts_vars["exam_date"].get().strip()
            exam_center= opts_vars["exam_center"].get().strip() or "............"
            doc_ref    = opts_vars["doc_ref"].get().strip()
            wilaya_val = opts_vars["wilaya"].get().strip()
            stage_type = stage_var.get()
            training_card_num = opts_vars["training_card_num"].get().strip()
            vehicle_nm = opts_vars["vehicle_nm"].get().strip()
            instructor_name = opts_vars["instructor_nm"].get().strip()

            default_exam_file = (f"liste_candidats_examen_{exam_date.replace('/','_')}.pdf"
                                 if LANG == "fr" else
                                 f"قائمة_المترشحين_{exam_date.replace('/','_')}.pdf")
            import tempfile as _tf; from datetime import datetime as _dtt
            path = _tf.gettempdir() + f"/exam_list_{int(_dtt.now().timestamp())}.pdf"

            dlg.destroy()
            self._generate_exam_list_pdf(
                path, selected_cands, school, exam_date,
                exam_center, doc_ref, wilaya_val, stage_type,
                default_name=default_exam_file,
                instructor_name=instructor_name,
                training_card_num=training_card_num,
                vehicle_nm=vehicle_nm)

        ModernButton(bf, T("examlist_gen_pdf"), do_generate,
                     icon="📄", color="#0369a1").pack(side=S(), padx=5)

    def _generate_exam_list_pdf(self, path, cands, school, exam_date,
                                 exam_center, doc_ref, wilaya_val, stage_type,
                                 default_name=None, instructor_name="",
                                 training_card_num="", vehicle_nm=""):
        """يولّد PDF قائمة المترشحين للامتحان — صفحة منفصلة لكل صنف."""
        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from collections import defaultdict

        is_fr = LANG == "fr"
        page_w, page_h = A4
        c = rl_canvas.Canvas(path, pagesize=A4)
        wilaya_display = _no_wnum(wilaya_val)

        # ── مساعدات نص ──────────────────────────────────────────────────────
        def _t(text):
            return str(text) if is_fr else ar(str(text))

        def txt_right(text, y_cm, font=ARABIC_FONT, size=10):
            c.setFont(font, size)
            c.drawRightString(page_w - 1.5*cm, y_cm * cm, _t(text))

        def txt_left(text, y_cm, font=ARABIC_FONT, size=10):
            c.setFont(font, size)
            c.drawString(1.5*cm, y_cm * cm, _t(text))

        def txt_center(text, y_cm, font=ARABIC_FONT, size=10):
            c.setFont(font, size)
            c.drawCentredString(page_w / 2, y_cm * cm, _t(text))

        # ── حساب العمر ──────────────────────────────────────────────────────
        def calc_age(birth_str):
            try:
                parts = birth_str.replace("/", "-").split("-")
                if len(parts) == 3:
                    by = int(parts[0]) if len(parts[0]) == 4 else int(parts[2])
                    return str(date.today().year - by)
            except Exception:
                pass
            return ""

        # ── معلومات المدرسة ──────────────────────────────────────────────────
        school_name  = school.get('name', '.....................')
        school_phone = school.get('phone', '')
        school_cr    = school.get('commercial_register', '') or school.get('registration_number', '')
        manager_name = school.get('manager_name') or '...................'

        # ── تحديد مرحلة الامتحان لكل مترشح ──────────────────────────────────
        def get_stage_for_cand(cand):
            if stage_type != "all":
                return stage_type
            stages = TrainingDB.get_by_candidate(cand['id'])
            active = None
            for st in reversed(STAGE_ORDER):
                s = next((x for x in stages if x['stage_type'] == st), None)
                if s and s['status'] not in ("لم يبدأ", "ناجح"):
                    active = st
                    break
            if not active:
                for st in STAGE_ORDER:
                    s = next((x for x in stages if x['stage_type'] == st), None)
                    if s and s['status'] == "لم يبدأ":
                        active = st
                        break
            return active or "code"

        STAGE_AR = {"code": "ق.م", "creneau": "المناورات", "circuit": "السياقة"}
        STAGE_FR = {"code": "C.R.", "creneau": "Man.", "circuit": "Con."}

        def stage_label(st):
            return STAGE_FR.get(st, st) if is_fr else STAGE_AR.get(st, st)

        # ── أبعاد الجدول (8 أعمدة) ───────────────────────────────────────────
        # الرقم | رقم التسجيل | اللقب و الاسم | تاريخ الميلاد | السن | الصنف | طبيعة الإمتحان | الملاحظة
        col_widths = [1.0, 2.5, 5.2, 2.8, 0.9, 1.1, 3.0, 2.5]
        total_w    = sum(col_widths)
        margin_l   = (page_w / cm - total_w) / 2

        if is_fr:
            col_x = [margin_l]
            for w in col_widths[:-1]:
                col_x.append(col_x[-1] + w)
        else:
            right_edge = page_w / cm - margin_l
            col_x = []
            x = right_edge
            for w in col_widths:
                col_x.append(x - w)
                x -= w

        row_h = 0.68
        hdr_h = 0.72

        if is_fr:
            col_headers = ["N°", "N° inscr.", "Nom et Prénom", "Date naiss.",
                           "Âge", "Cat.", "Nature exam.", "Observation"]
        else:
            col_headers = ["الرقم", "رقم التسجيل", "اللقب و الاسم", "تاريخ الميلاد",
                           "السن", "الصنف", "طبيعة الإمتحان", "الملاحظة"]

        # الفواصل العمودية الداخلية (RTL: col_x[0]..col_x[-2] | LTR: col_x[1:])
        _inner_seps = col_x[1:] if is_fr else col_x[:-1]

        # ── رسم رأس الجدول (صف أحادي) ───────────────────────────────────────
        def draw_table_header(y_top):
            y_bot = y_top - hdr_h
            c.setFillColorRGB(1, 1, 1)
            c.setStrokeColorRGB(0, 0, 0)
            c.setLineWidth(0.5)
            c.rect(margin_l*cm, y_bot*cm, total_w*cm, hdr_h*cm, fill=1, stroke=1)
            c.setFillColorRGB(0, 0, 0)
            for lbl, cw, cx in zip(col_headers, col_widths, col_x):
                c.setFont(ARABIC_FONT_BOLD, 8)
                c.drawCentredString(
                    (cx + cw / 2)*cm,
                    (y_bot + hdr_h * 0.38)*cm,
                    _t(lbl))
            c.setStrokeColorRGB(0, 0, 0)
            c.setLineWidth(0.5)
            for cx in _inner_seps:
                c.line(cx*cm, y_bot*cm, cx*cm, y_top*cm)
            c.setFillColorRGB(0, 0, 0)
            return y_bot

        # ── رسم الترويسة الرسمية الكاملة ─────────────────────────────────────
        def draw_full_header(cat_name):
            y = 28.5

            # ① الجمهورية — منتصف + تسطير
            txt_center(_pdf_t("الجمهورية الجزائرية الديمقراطية الشعبية",
                               "République Algérienne Démocratique et Populaire"),
                       y, ARABIC_FONT_BOLD, 13 if not is_fr else 11)
            c.setLineWidth(0.8)
            c.line(page_w*0.25, (y - 0.15)*cm, page_w*0.75, (y - 0.15)*cm)

            # ② الوزارة والمندوبيات — يمين فقط
            y -= 0.60
            txt_right(_pdf_t("وزارة الداخلية و الجماعات المحلية و التهيئة العمرانية",
                              "Ministère de l'Intérieur, des Collectivités Locales"),
                      y, ARABIC_FONT, 8)
            y -= 0.48
            txt_right(_pdf_t("المندوبيـة الوطنية للأمـن في الطرق",
                              "Délégation Nationale à la Sécurité Routière"),
                      y, ARABIC_FONT, 8)
            y -= 0.48
            txt_right(_pdf_t(f"المندوبية الولائية للأمن في الطرق لولاية {wilaya_display}",
                              f"Délégation de Wilaya à la Sécurité Routière - {wilaya_display}"),
                      y, ARABIC_FONT, 8)

            # ④ عنوان الوثيقة — منتصف + تسطير
            y -= 0.85
            txt_center(_pdf_t("قائمة المترشحين لنيل رخصة السياقة",
                               "Liste des candidats au permis de conduire"),
                       y, ARABIC_FONT_BOLD, 14 if not is_fr else 12)
            title_w = 10 * cm
            c.setLineWidth(0.8)
            c.line((page_w - title_w) / 2, (y - 0.12)*cm,
                   (page_w + title_w) / 2, (y - 0.12)*cm)
            # اسم الصنف تحت العنوان
            y -= 0.55
            txt_center(_pdf_t(f"الصنف :  {cat_name}",
                               f"Catégorie :  {cat_name}"),
                       y, ARABIC_FONT_BOLD, 12)

            # ⑥ اسم المدرسة — يمين
            y -= 0.72
            txt_right(_pdf_t(f"مدرسة تعليم السياقة:  {school_name}",
                              f"Auto-école :  {school_name}"),
                      y, ARABIC_FONT_BOLD, 10)

            # ⑦ مسيّر — يمين
            y -= 0.45
            txt_right(_pdf_t(f"مسيّر:  {manager_name}",
                              f"Responsable :  {manager_name}"),
                      y, ARABIC_FONT, 9)

            # ⑧ السطر 3: ن.س + ر.ت يمين | ر.ب.ت وسط | ممرن يسار
            y -= 0.44
            _veh_parts = vehicle_nm.split(" — ", 1) if vehicle_nm else []
            _veh_type  = _veh_parts[0].strip() if len(_veh_parts) > 0 else ""
            _veh_plate = _veh_parts[1].strip() if len(_veh_parts) > 1 else ""
            if _veh_type or _veh_plate:
                _ns_label = f"{'N.V.' if is_fr else 'ن.س'}:  {_veh_type}  {'R.T.' if is_fr else 'ر.ت'}:  {_veh_plate}"
                txt_right(_pdf_t(_ns_label, _ns_label), y, ARABIC_FONT, 9)
            _brt = training_card_num or "............"
            txt_center(_pdf_t(f"ر.ب.ت:  {_brt}", f"B.R.T. :  {_brt}"),
                       y, ARABIC_FONT, 9)
            if instructor_name:
                txt_left(_pdf_t(f"ممرن:  {instructor_name}",
                                 f"Moniteur :  {instructor_name}"),
                         y, ARABIC_FONT, 9)

            # ⑨ السطر 4: مركز الامتحان يمين | تاريخ الامتحان يسار
            y -= 0.44
            txt_right(_pdf_t(f"مركز الامتحان:  {exam_center}",
                              f"Centre d'examen :  {exam_center}"),
                      y, ARABIC_FONT, 9)
            txt_left(_pdf_t(f"تاريخ الامتحان:  {exam_date}",
                             f"Date d'examen :  {exam_date}"),
                     y, ARABIC_FONT, 9)

            y -= 0.35
            return y

        # ── رسم التذييل: قسمان (المدعوون يمين / المقبولون يسار) ─────────────
        def draw_footer(cat_cands_list, y_cur, cnt_code, cnt_creneau, cnt_circuit):
            total = len(cat_cands_list)

            y = y_cur - 0.4
            c.setLineWidth(0.8)
            c.line(margin_l*cm, y*cm, (margin_l + total_w)*cm, y*cm)

            # خط فاصل عمودي في المنتصف
            mid_x = page_w / 2
            c.setLineWidth(0.5)
            c.line(mid_x, y*cm, mid_x, (y - 3.0)*cm)
            c.setLineWidth(0.8)

            # يمين: المدعوون (أعداد محسوبة)
            y -= 0.55
            txt_right(_pdf_t(f"المترشحين المدعوين:  {total}",
                              f"Candidats convoqués :  {total}"),
                      y, ARABIC_FONT_BOLD, 11)
            y -= 0.55
            txt_right(_pdf_t(f"قانون المرور:  {cnt_code:02d}",
                              f"Code de la route :  {cnt_code:02d}"),
                      y, ARABIC_FONT, 10)
            y -= 0.50
            txt_right(_pdf_t(f"المناورات:  {cnt_creneau:02d}",
                              f"Manoeuvres :  {cnt_creneau:02d}"),
                      y, ARABIC_FONT, 10)
            y -= 0.50
            txt_right(_pdf_t(f"السياقة:  {cnt_circuit:02d}",
                              f"Conduite :  {cnt_circuit:02d}"),
                      y, ARABIC_FONT, 10)

            # يسار: المقبولون (خطوط منقوطة للكتابة اليدوية)
            y_left = y_cur - 0.55 - 0.55
            txt_left(_pdf_t("المترشحين المقبولين:",
                             "Candidats admis :"),
                     y_left, ARABIC_FONT_BOLD, 11)
            y_left -= 0.50
            txt_left(_pdf_t("قانون المرور: ........", "Code de la route : ........"),
                     y_left, ARABIC_FONT, 10)
            y_left -= 0.50
            txt_left(_pdf_t("المناورات: ........",    "Manoeuvres : ........"),
                     y_left, ARABIC_FONT, 10)
            y_left -= 0.50
            txt_left(_pdf_t("السياقة: ........",      "Conduite : ........"),
                     y_left, ARABIC_FONT, 10)


        # ── تجميع المترشحين حسب الصنف (A و A1 في مجموعة واحدة) ───────────────
        _PDF_A_GROUP = {"A", "A1"}

        def _pdf_norm_cat(lic):
            v = (lic or "").strip()
            return "A/A1" if v in _PDF_A_GROUP else v

        cat_groups = defaultdict(list)
        for cand in cands:
            cat = _pdf_norm_cat((cand.get('license_type') or 'ب').strip() or 'ب')
            cat_groups[cat].append(cand)
        _cat_order = ["A/A1", "B", "C1", "C", "D", "BE", "C1E", "CE", "DE", "F", "ب"]
        categories = [c for c in _cat_order if c in cat_groups] + \
                     [c for c in sorted(cat_groups.keys()) if c not in _cat_order]

        # ── حلقة الأصناف — صفحة منفصلة لكل صنف ──────────────────────────────
        first_cat = True
        for cat in categories:
            cat_cands = cat_groups[cat]
            if not first_cat:
                c.showPage()
            first_cat = False

            y = draw_full_header(cat)
            y = draw_table_header(y)

            FOOTER_H   = 4.2
            prev_stage = None
            cnt_code = cnt_creneau = cnt_circuit = 0

            for idx, cand in enumerate(cat_cands):
                if y - row_h < FOOTER_H + 1.0:
                    c.showPage()
                    y = 27.5
                    y = draw_table_header(y)
                    prev_stage = None

                age_str   = calc_age(cand.get('birth_date', ''))
                reg_num   = cand.get('file_number', '') or ''
                full_name = f"{cand.get('last_name', '')} {cand.get('first_name', '')}"
                birth_d   = cand.get('birth_date', '')
                lic_type  = cand.get('license_type', 'ب')
                row_num   = idx + 1

                # تحديد المرحلة وتحديث العدادات
                st_key = get_stage_for_cand(cand)
                if st_key == "code":      cnt_code     += 1
                elif st_key == "creneau": cnt_creneau  += 1
                elif st_key == "circuit": cnt_circuit  += 1

                # نمط "//": نفس المرحلة السابقة → "//"
                stage_cell = "//" if st_key == prev_stage else stage_label(st_key)
                prev_stage = st_key

                # خلفية الصف
                c.setFillColorRGB(1, 1, 1) if idx % 2 == 0 \
                    else c.setFillColorRGB(0.95, 0.97, 1.0)
                c.rect(margin_l*cm, (y - row_h)*cm, total_w*cm, row_h*cm, fill=1, stroke=0)
                c.setFillColorRGB(0, 0, 0)

                # حدود الصف
                c.setStrokeColorRGB(0, 0, 0)
                c.setLineWidth(0.5)
                c.rect(margin_l*cm, (y - row_h)*cm, total_w*cm, row_h*cm, fill=0, stroke=1)
                for cx in _inner_seps:
                    c.line(cx*cm, (y - row_h)*cm, cx*cm, y*cm)

                # بيانات الصف — 8 أعمدة
                row_data = [str(row_num), reg_num, full_name, birth_d,
                            age_str, lic_type, stage_cell, ""]
                for i, (val, cw, cx) in enumerate(zip(row_data, col_widths, col_x)):
                    use_latin = i in (0, 1, 4) or (i == 3 and not is_fr)
                    font  = "Helvetica" if use_latin else ARABIC_FONT
                    fsize = 7 if i == 2 else 8
                    c.setFont(font, fsize)
                    c.drawCentredString(
                        (cx + cw / 2)*cm,
                        (y - row_h * 0.62)*cm,
                        str(val) if use_latin else _t(val))

                y -= row_h

            draw_footer(cat_cands, y, cnt_code, cnt_creneau, cnt_circuit)

        c.save()
        self._trigger_print(path, _pdf_t("قائمة المترشحين للامتحان",
                                         "Liste des candidats à l'examen"),
                            default_name=default_name)


# ============================================================================
#  نافذة المتخرجون
# ============================================================================

class GraduatesFrame(tk.Frame):
    """يعرض المترشحين الذين أكملوا مراحل التكوين بنجاح."""

    def __init__(self, parent):
        super().__init__(parent, bg=COLOR_BG)
        self.selected_id = None
        self._build()
        self._load_list()

    def _build(self):
        wrap = tk.Frame(self, bg=COLOR_BG, padx=20, pady=15)
        wrap.pack(fill="both", expand=True)

        # ── رأس الصفحة ──────────────────────────────────────────────────────
        head = tk.Frame(wrap, bg=COLOR_BG)
        head.pack(fill="x", pady=(0, 15))

        right_head = tk.Frame(head, bg=COLOR_BG)
        right_head.pack(side="right")
        tk.Label(right_head, text=T("nav_graduates"),
                 font=(FONT_FAMILY, 20, "bold"),
                 bg=COLOR_BG, fg=COLOR_HEADER, anchor=A()).pack(anchor=A())
        sub = ("المترشحون الذين أكملوا جميع مراحل التكوين بنجاح"
               if LANG == "ar" else
               "Candidats ayant réussi toutes les étapes de formation")
        tk.Label(right_head, text=sub,
                 font=FONT_MAIN, bg=COLOR_BG, fg=COLOR_TEXT_LIGHT,
                 anchor=A()).pack(anchor=A())

        left_head = tk.Frame(head, bg=COLOR_BG)
        left_head.pack(side="left")
        self.count_var = tk.StringVar(value="")
        tk.Label(left_head, textvariable=self.count_var,
                 font=(FONT_FAMILY, 14, "bold"),
                 bg=COLOR_BG, fg=COLOR_SUCCESS).pack(side="left", padx=8)

        # ── شريط البحث ──────────────────────────────────────────────────────
        sc_outer, sc = make_card(wrap, padding=15)
        sc_outer.pack(fill="x", pady=(0, 10))
        tk.Label(sc, text="🔍", font=(FONT_FAMILY, 14),
                 bg=COLOR_CARD, fg=COLOR_PRIMARY).pack(side="right", padx=(0, 8))
        self.search_var = tk.StringVar()
        self.search_var.trace("w", lambda *a: self._load_list())
        make_entry(sc, self.search_var, width=40).pack(
            side="right", fill="x", expand=True, ipady=6)
        lbl_s = ("بحث بالاسم أو الهاتف" if LANG == "ar"
                 else "Rechercher par nom ou téléphone")
        tk.Label(sc, text=lbl_s, font=FONT_BOLD,
                 bg=COLOR_CARD, fg=COLOR_TEXT, anchor=A()).pack(side="right", padx=10)

        # ── جدول المتخرجين ──────────────────────────────────────────────────
        tbl_outer, tbl_card = make_card(wrap, padding=10)
        tbl_outer.pack(fill="both", expand=True)
        cols   = ("id", "last_name", "first_name", "national_id",
                  "gender", "phone", "license_type",
                  "instructor_name", "registration_date")
        heads  = (T("cand_col_num"), T("cand_col_lname"), T("cand_col_fname"),
                  T("cand_col_nid"), T("cand_col_gender"), T("cand_col_phone"),
                  T("cand_col_license"), T("cand_col_inst"), T("cand_col_date"))
        widths = (50, 130, 130, 150, 70, 115, 80, 155, 125)
        self.tree = create_treeview(tbl_card, cols, heads, widths, height=20)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

    def _load_list(self):
        rows   = CandidateDB.get_graduates(self.search_var.get())
        values = [(r['id'], r['last_name'], r['first_name'],
                   r.get('national_id', '') or '—', r['gender'], r['phone'],
                   r['license_type'], r.get('instructor_name', '') or '—',
                   r['registration_date'])
                  for r in rows]
        insert_zebra(self.tree, values)
        n     = len(values)
        label = (f"إجمالي المتخرجين: {n}" if LANG == "ar"
                 else f"Total diplômés : {n}")
        self.count_var.set(label)

    def _on_select(self, event):
        sel = self.tree.selection()
        if sel:
            self.selected_id = self.tree.item(sel[0])['values'][0]


# ============================================================================
#  نافذة تسجيل الدخول
# ============================================================================

class LoginWindow:
    """نافذة تسجيل الدخول — تظهر عند بدء البرنامج."""

    def __init__(self):
        init_db()
        upgrade_db()

        self.root = tk.Tk()
        self.root.title(T("login_title"))
        _set_app_icon(self.root)
        self.root.geometry("460x560")
        self.root.minsize(460, 560)
        self.root.resizable(True, True)
        self.root.configure(bg=COLOR_SIDEBAR)
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x  = (sw - 460) // 2
        y  = (sh - 560) // 2
        self.root.geometry(f"460x560+{x}+{y}")

        # ── عداد فترة التجربة في عنوان النافذة ───────────────────────────
        try:
            import math as _math
            from license_guard import trial_remaining_seconds as _trial_rem

            def _update_trial_title():
                rem = _trial_rem()
                if rem is not None and rem > 0:
                    # ceil حتى يُعرض 30 يوماً عند أول تشغيل بدلاً من 29 يوماً
                    total_mins = _math.ceil(rem / 60)
                    days = total_mins // (24 * 60)
                    h = (total_mins % (24 * 60)) // 60
                    m = total_mins % 60
                    self.root.title(
                        f"برنامج ميدانيك  |  ⏳ التجربة: {days}ي {h:02d}س {m:02d}د متبقية"
                    )
                    self.root.after(60_000, _update_trial_title)
                # rem is None (مرخّص دائم) أو rem == 0 → لا يُعدَّل العنوان

            _update_trial_title()
        except ImportError:
            pass
        # ──────────────────────────────────────────────────────────────────

        self._build()
        self.root.mainloop()

    def _build(self):
        tk.Frame(self.root, bg=COLOR_ACCENT, height=5).pack(fill="x")

        head = tk.Frame(self.root, bg=COLOR_SIDEBAR, pady=28)
        head.pack(fill="x")
        tk.Label(head, text="🚗", font=(FONT_FAMILY, 38),
                 bg=COLOR_SIDEBAR, fg=COLOR_ACCENT).pack()
        tk.Label(head, text=T("brand_name"), font=(FONT_FAMILY, 22, "bold"),
                 bg=COLOR_SIDEBAR, fg="white").pack(pady=(4, 0))
        tk.Label(head, text=T("login_app_sub"),
                 font=(FONT_FAMILY, 9), bg=COLOR_SIDEBAR, fg="#94a3b8").pack(pady=(2, 0))

        card = tk.Frame(self.root, bg=COLOR_CARD, padx=34, pady=28)
        card.pack(fill="x", padx=24, pady=12)

        tk.Label(card, text=T("login_heading"), font=(FONT_FAMILY, 14, "bold"),
                 bg=COLOR_CARD, fg=COLOR_HEADER, anchor=A()).pack(fill="x", pady=(0, 18))

        tk.Label(card, text=T("login_username"), font=FONT_BOLD,
                 bg=COLOR_CARD, fg=COLOR_TEXT, anchor=A()).pack(fill="x")
        self._v_user = tk.StringVar()
        self._e_user = tk.Entry(card, textvariable=self._v_user,
                                font=FONT_MAIN, bg=COLOR_INPUT_BG,
                                relief="flat", bd=0, highlightthickness=2,
                                highlightcolor=COLOR_PRIMARY,
                                highlightbackground=COLOR_BORDER,
                                justify=J())
        self._e_user.pack(fill="x", ipady=10, pady=(4, 14))

        tk.Label(card, text=T("login_password"), font=FONT_BOLD,
                 bg=COLOR_CARD, fg=COLOR_TEXT, anchor=A()).pack(fill="x")
        self._v_pass = tk.StringVar()
        self._e_pass = tk.Entry(card, textvariable=self._v_pass,
                                font=FONT_MAIN, show="●",
                                bg=COLOR_INPUT_BG, relief="flat", bd=0,
                                highlightthickness=2,
                                highlightcolor=COLOR_PRIMARY,
                                highlightbackground=COLOR_BORDER,
                                justify=J())
        self._e_pass.pack(fill="x", ipady=10, pady=(4, 22))

        btn_frame = tk.Frame(card, bg=COLOR_PRIMARY, cursor="hand2")
        btn_frame.pack(fill="x")
        self._login_lbl = tk.Label(btn_frame, text=T("login_btn"),
                                   font=(FONT_FAMILY, 13, "bold"),
                                   bg=COLOR_PRIMARY, fg="white", pady=12)
        self._login_lbl.pack(fill="x")

        for w in [btn_frame, self._login_lbl]:
            w.bind("<Button-1>", lambda e: self._do_login())
            w.bind("<Enter>",    lambda e: (btn_frame.configure(bg=COLOR_PRIMARY_DARK),
                                            self._login_lbl.configure(bg=COLOR_PRIMARY_DARK)))
            w.bind("<Leave>",    lambda e: (btn_frame.configure(bg=COLOR_PRIMARY),
                                            self._login_lbl.configure(bg=COLOR_PRIMARY)))

        self._err_lbl = tk.Label(card, text="", font=FONT_SMALL,
                                 bg=COLOR_CARD, fg=COLOR_DANGER)
        self._err_lbl.pack(pady=(10, 0))

        hint = tk.Frame(self.root, bg=COLOR_SIDEBAR, padx=24, pady=8)
        hint.pack(fill="x")
        tk.Label(hint, text=T("login_hint"),
                 font=FONT_TINY, bg=COLOR_SIDEBAR, fg="#64748b",
                 anchor=A()).pack(fill="x")

        contact = tk.Frame(self.root, bg=COLOR_SIDEBAR, padx=24, pady=6)
        contact.pack(fill="x")
        tk.Label(contact,
                 text="📞 +213540772807   |   WhatsApp +213540772807   |   ✉ contact@midanic.com",
                 font=FONT_TINY, bg=COLOR_SIDEBAR, fg="#64748b",
                 anchor="center").pack(fill="x")

        self._e_user.bind("<Return>", lambda e: self._e_pass.focus())
        self._e_pass.bind("<Return>", lambda e: self._do_login())
        self._e_user.focus()

    def _do_login(self):
        username = self._v_user.get().strip()
        password = self._v_pass.get()
        if not username or not password:
            self._err_lbl.configure(text=T("login_err_empty"))
            return
        user = UserDB.authenticate(username, password)
        if user is None:
            self._err_lbl.configure(text=T("login_err_bad"))
            self._e_pass.delete(0, "end")
            self._e_pass.focus()
            return
        self.root.destroy()
        DrivingSchoolApp(current_user=user)


# ============================================================================
#  إدارة المستخدمين (حوار)
# ============================================================================

class UserManagementDialog(tk.Toplevel):
    """نافذة إدارة المستخدمين — للمدير فقط."""

    def __init__(self, parent, current_user_id=None):
        super().__init__(parent)
        self.title(T("users_title"))
        self.geometry("860x600")
        self.resizable(True, True)
        self.configure(bg=COLOR_BG)
        self.grab_set()
        self._current_uid = current_user_id
        self._selected_uid = None
        self._build()
        self._refresh()

    def _build(self):
        hdr = tk.Frame(self, bg=COLOR_PRIMARY, padx=20, pady=14)
        hdr.pack(fill="x")
        tk.Label(hdr, text=T("users_header"),
                 font=FONT_TITLE, bg=COLOR_PRIMARY, fg="white").pack(anchor=A())

        bar = tk.Frame(self, bg=COLOR_BG, padx=16, pady=10)
        bar.pack(fill="x")
        ModernButton(bar, T("users_new"), self._add_user,
                     color=COLOR_SUCCESS, icon="➕").pack(side="right", padx=(0, 8))
        ModernButton(bar, T("users_edit"), self._edit_user,
                     color=COLOR_PRIMARY, icon="✏️").pack(side="right", padx=(0, 8))
        ModernButton(bar, T("users_change_pass"), self._change_pass,
                     color=COLOR_WARNING, icon="🔑").pack(side="right", padx=(0, 8))
        ModernButton(bar, T("users_delete"), self._delete_user,
                     color=COLOR_DANGER, icon="🗑").pack(side="right", padx=(0, 8))

        tree_f = tk.Frame(self, bg=COLOR_BG, padx=16, pady=4)
        tree_f.pack(fill="both", expand=True)

        cols = ("id", "username", "full_name", "role", "perms")
        self._tree = ttk.Treeview(tree_f, columns=cols, show="headings",
                                  style="Modern.Treeview", selectmode="browse")
        hdrs = {"id": ("ID", 40), "username": (T("users_col_uname"), 120),
                "full_name": (T("users_col_fullname"), 160), "role": (T("users_col_role"), 90),
                "perms": (T("users_col_perms"), 380)}
        for c, (h, w) in hdrs.items():
            self._tree.heading(c, text=h, anchor=A())
            self._tree.column(c, width=w, anchor=A(), minwidth=40)
        sb = ttk.Scrollbar(tree_f, orient="vertical", command=self._tree.yview,
                           style="Thin.Vertical.TScrollbar")
        self._tree.configure(yscrollcommand=sb.set)
        self._tree.pack(side="right", fill="both", expand=True)
        sb.pack(side="left", fill="y")
        self._tree.bind("<<TreeviewSelect>>", self._on_select)

    def _refresh(self):
        for row in self._tree.get_children():
            self._tree.delete(row)
        for u in UserDB.get_all():
            role_lbl = T("users_role_admin") if u["role"] == "admin" else T("users_role_inst")
            if u["role"] == "admin":
                perms_str = T("users_all_perms")
            else:
                granted = [PERMISSION_LABELS[k]
                           for k in PERMISSION_KEYS if u["permissions"].get(k)]
                perms_str = " | ".join(granted) if granted else T("users_no_perms")
            self._tree.insert("", "end", iid=str(u["id"]),
                              values=(u["id"], u["username"],
                                      u.get("full_name") or "—",
                                      role_lbl, perms_str))

    def _on_select(self, _=None):
        sel = self._tree.selection()
        self._selected_uid = int(sel[0]) if sel else None

    def _get_selected(self):
        if not self._selected_uid:
            messagebox.showwarning(T("msg_warning"), T("user_mgmt_sel_first"), parent=self)
            return None
        return UserDB.get(self._selected_uid)

    def _add_user(self):
        dlg = _UserFormDialog(self, title=T("user_new_title"), user=None)
        self.wait_window(dlg)
        if dlg.result:
            try:
                UserDB.add(dlg.result)
                self._refresh()
            except Exception as ex:
                messagebox.showerror(T("msg_error"), f"{T('user_mgmt_add_fail')}\n{ex}", parent=self)

    def _edit_user(self):
        u = self._get_selected()
        if not u:
            return
        if u.get("role") == "admin":
            messagebox.showinfo(T("msg_info"), T("user_mgmt_admin_info"), parent=self)
            return
        dlg = _UserFormDialog(self, title=T("user_edit_title"), user=u)
        self.wait_window(dlg)
        if dlg.result:
            UserDB.update(u["id"], dlg.result)
            self._refresh()

    def _change_pass(self):
        u = self._get_selected()
        if not u:
            return
        dlg = _ChangePasswordDialog(self, user=u)
        self.wait_window(dlg)

    def _delete_user(self):
        u = self._get_selected()
        if not u:
            return
        if u["id"] == self._current_uid:
            messagebox.showwarning(T("msg_warning"), T("users_err_del_self"), parent=self)
            return
        if u.get("username") == "midanic":
            messagebox.showwarning(T("msg_warning"), T("users_err_del_admin"), parent=self)
            return
        if not messagebox.askyesno(T("msg_confirm_del"),
                                   f"{T('msg_confirm_del_q')} «{u['username']}»؟",
                                   parent=self):
            return
        UserDB.delete(u["id"])
        self._selected_uid = None
        self._refresh()


class _UserFormDialog(tk.Toplevel):
    """نموذج إضافة / تعديل مستخدم."""

    def __init__(self, parent, title, user=None):
        super().__init__(parent)
        self.title(title)
        self.geometry("500x620")
        self.minsize(500, 620)
        self.resizable(True, True)
        self.configure(bg=COLOR_BG)
        self.grab_set()
        self.result     = None
        self._user      = user
        self._perm_vars = {}
        self._build()
        if user:
            self._populate(user)

    def _build(self):
        hdr = tk.Frame(self, bg=COLOR_PRIMARY, padx=16, pady=12)
        hdr.pack(fill="x")
        tk.Label(hdr, text=self.title(), font=FONT_TITLE,
                 bg=COLOR_PRIMARY, fg="white").pack(anchor=A())

        # ── زر الحفظ ثابت في الأسفل ──
        footer = tk.Frame(self, bg=COLOR_BG, padx=20, pady=10)
        footer.pack(fill="x", side="bottom")
        ModernButton(footer, T("user_save_btn"), self._save, color=COLOR_SUCCESS).pack(fill="x")

        # ── جسم قابل للتمرير ──
        wrapper = tk.Frame(self, bg=COLOR_BG)
        wrapper.pack(fill="both", expand=True)
        canvas = tk.Canvas(wrapper, bg=COLOR_BG, highlightthickness=0)
        vsb    = ttk.Scrollbar(wrapper, orient="vertical", command=canvas.yview,
                               style="Thin.Vertical.TScrollbar")
        canvas.configure(yscrollcommand=vsb.set)
        vsb.pack(side="left", fill="y")
        canvas.pack(side="right", fill="both", expand=True)

        body = tk.Frame(canvas, bg=COLOR_BG, padx=20, pady=16)
        canvas_win = canvas.create_window((0, 0), window=body, anchor="nw")

        def _on_configure(e):
            canvas.configure(scrollregion=canvas.bbox("all"))
            canvas.itemconfig(canvas_win, width=canvas.winfo_width())
        body.bind("<Configure>", _on_configure)
        canvas.bind("<Configure>",
                    lambda e: canvas.itemconfig(canvas_win, width=e.width))

        is_new = self._user is None

        def lbl(txt):
            tk.Label(body, text=txt, font=FONT_BOLD,
                     bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")

        def entry_field(show=None):
            v = tk.StringVar()
            kw = {"show": show} if show else {}
            e = tk.Entry(body, textvariable=v, font=FONT_MAIN,
                         bg=COLOR_INPUT_BG, relief="flat", bd=0,
                         highlightthickness=1, highlightbackground=COLOR_BORDER,
                         highlightcolor=COLOR_PRIMARY, justify=J(), **kw)
            e.pack(fill="x", ipady=8, pady=(3, 12))
            return v

        lbl(T("user_fullname_f"))
        self._v_full_name = entry_field()

        if is_new:
            lbl(T("user_username_f"))
            self._v_username = entry_field()
            lbl(T("user_pass_f"))
            self._v_password = entry_field(show="●")

        # ── الصلاحيات ──
        pf = tk.LabelFrame(body, text=T("user_perms_f"), font=FONT_BOLD,
                            bg=COLOR_BG, fg=COLOR_PRIMARY,
                            padx=10, pady=8, relief="groove")
        pf.pack(fill="x", pady=(4, 14))
        for key in PERMISSION_KEYS:
            v = tk.BooleanVar(value=False)
            self._perm_vars[key] = v
            tk.Checkbutton(pf, text=PERMISSION_LABELS[key],
                           variable=v, font=FONT_SMALL,
                           bg=COLOR_BG, fg=COLOR_TEXT,
                           activebackground=COLOR_BG,
                           anchor=A(), justify=J(),
                           selectcolor=COLOR_PRIMARY_LIGHT).pack(fill="x", pady=2)


    def _populate(self, u):
        self._v_full_name.set(u.get("full_name") or "")
        for k, v in self._perm_vars.items():
            v.set(bool(u.get("permissions", {}).get(k, False)))

    def _save(self):
        full_name = self._v_full_name.get().strip()
        perms     = {k: v.get() for k, v in self._perm_vars.items()}
        d = {"full_name": full_name, "role": "trainer", "permissions": perms}
        if self._user is None:
            username = self._v_username.get().strip()
            password = self._v_password.get()
            if not username:
                messagebox.showwarning(T("msg_warning"), T("user_warn_no_usr"), parent=self)
                return
            if not password:
                messagebox.showwarning(T("msg_warning"), T("user_warn_no_pwd"), parent=self)
                return
            d["username"] = username
            d["password"] = password
        self.result = d
        self.destroy()


class _ChangePasswordDialog(tk.Toplevel):
    """حوار تغيير كلمة مرور مستخدم."""

    def __init__(self, parent, user):
        super().__init__(parent)
        self.title(f"{T('user_change_pass')} — {user['username']}")
        self.geometry("400x280")
        self.minsize(400, 280)
        self.resizable(True, True)
        self.configure(bg=COLOR_BG)
        self.grab_set()
        self._uid = user["id"]
        self._build()

    def _build(self):
        hdr = tk.Frame(self, bg=COLOR_WARNING, padx=16, pady=12)
        hdr.pack(fill="x")
        tk.Label(hdr, text=T("user_chg_pwd_ttl"), font=FONT_TITLE,
                 bg=COLOR_WARNING, fg="white").pack(anchor=A())

        body = tk.Frame(self, bg=COLOR_BG, padx=24, pady=20)
        body.pack(fill="both", expand=True)

        def lbl(txt):
            tk.Label(body, text=txt, font=FONT_BOLD,
                     bg=COLOR_BG, fg=COLOR_TEXT, anchor=A()).pack(fill="x")

        def entry_pass():
            v = tk.StringVar()
            e = tk.Entry(body, textvariable=v, show="●", font=FONT_MAIN,
                         bg=COLOR_INPUT_BG, relief="flat", bd=0,
                         highlightthickness=1, highlightbackground=COLOR_BORDER,
                         highlightcolor=COLOR_PRIMARY, justify=J())
            e.pack(fill="x", ipady=8, pady=(3, 14))
            return v

        lbl(T("user_new_pass_f"))
        self._v_new  = entry_pass()
        lbl(T("user_conf_pass_f"))
        self._v_conf = entry_pass()

        ModernButton(body, T("user_save_pass"), self._save,
                     color=COLOR_SUCCESS).pack(fill="x")

    def _save(self):
        new  = self._v_new.get()
        conf = self._v_conf.get()
        if not new:
            messagebox.showwarning(T("msg_warning"), T("user_warn_no_newpwd"), parent=self)
            return
        if new != conf:
            messagebox.showwarning(T("msg_warning"), T("user_warn_mismatch"), parent=self)
            return
        if len(new) < 4:
            messagebox.showwarning(T("msg_warning"), T("user_warn_short"), parent=self)
            return
        UserDB.change_password(self._uid, new)
        messagebox.showinfo(T("user_done_ttl"), T("user_pwd_done"), parent=self)
        self.destroy()


# ============================================================================
#  التطبيق الرئيسي
# ============================================================================

class DrivingSchoolApp:
    def __init__(self, current_user: dict = None):
        seed_demo_data()
        # حساب افتراضي إن لم يُمرَّر
        if current_user is None:
            current_user = {"id": 0, "username": "midanic",
                            "full_name": "مدير النظام", "role": "admin",
                            "permissions": {}}
        self._current_user = current_user
        # نشر المستخدم الحالي على مستوى الوحدة لتستفيد منه الـframes
        global CURRENT_USER
        CURRENT_USER = current_user
        self.root = tk.Tk()
        self.root.title(T("app_title"))
        _set_app_icon(self.root)
        self.root.geometry("1280x800")
        self.root.minsize(1000, 650)
        self.root.configure(bg="#f1f5f9")
        try:
            self.root.state('zoomed')
        except Exception:
            try:
                self.root.attributes('-zoomed', True)
            except Exception:
                pass

        self._nav_refs     = []
        self._current_idx  = -1
        self._page_frames  = []
        self._topbar_title = None

        self._setup_styles()
        self._build_layout()
        self._build_status_bar()
        self.root.mainloop()

    # ──────────────────────────────────────────────────────────
    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        # Notebook (للنوافذ المنبثقة)
        style.configure("Modern.TNotebook", background=COLOR_CARD, borderwidth=0,
                        tabmargins=[2, 5, 2, 0])
        style.configure("Modern.TNotebook.Tab",
                        font=(FONT_FAMILY, 10, "bold"), padding=[14, 8],
                        background="#e2e8f0", foreground=COLOR_TEXT, borderwidth=0)
        style.map("Modern.TNotebook.Tab",
                  background=[("selected", COLOR_PRIMARY), ("active", "#cbd5e1")],
                  foreground=[("selected", "white")])

        # Treeview
        style.configure("Modern.Treeview", font=FONT_MAIN, rowheight=32,
                        background=COLOR_CARD, foreground=COLOR_TEXT,
                        fieldbackground=COLOR_CARD, borderwidth=0)
        style.configure("Modern.Treeview.Heading",
                        font=(FONT_FAMILY, 11, "bold"),
                        background=COLOR_HEADER, foreground="white",
                        relief="flat", borderwidth=0, padding=[8, 8])
        style.map("Modern.Treeview",
                  background=[("selected", COLOR_PRIMARY)],
                  foreground=[("selected", "white")])
        style.map("Modern.Treeview.Heading",
                  background=[("active", COLOR_PRIMARY_DARK)])

        # Combobox
        style.configure("Modern.TCombobox",
                        fieldbackground=COLOR_INPUT_BG,
                        background=COLOR_CARD, borderwidth=1,
                        relief="flat", padding=4)

        # ── أشرطة تمرير رفيعة وعصرية ──
        for orient in ("Vertical", "Horizontal"):
            style.configure(f"Thin.{orient}.TScrollbar",
                            background="#cbd5e1", troughcolor="#f1f5f9",
                            borderwidth=0, arrowsize=0, width=8, relief="flat")
            style.map(f"Thin.{orient}.TScrollbar",
                      background=[("active", "#94a3b8"),
                                  ("pressed", "#64748b"),
                                  ("disabled", "#e2e8f0")])

    # ──────────────────────────────────────────────────────────
    def _build_layout(self):
        """البنية الكاملة: شريط جانبي يسار 200px + منطقة محتوى يمين."""
        main = tk.Frame(self.root, bg="#f1f5f9")
        main.pack(fill="both", expand=True)

        # ── الشريط الجانبي (يمين في AR — يسار في FR) ──
        self.sidebar = tk.Frame(main, bg=COLOR_SIDEBAR, width=200)
        self.sidebar.pack(side=S(), fill="y")
        self.sidebar.pack_propagate(False)
        self._build_sidebar()

        # ── منطقة المحتوى (تملأ الباقي) ──
        content_wrapper = tk.Frame(main, bg="#f1f5f9")
        content_wrapper.pack(side=So(), fill="both", expand=True)

        self._build_topbar(content_wrapper)

        self.content = tk.Frame(content_wrapper, bg="#f1f5f9")
        self.content.pack(fill="both", expand=True, padx=14, pady=(8, 12))

        self._build_frames()
        # انتقل لأول صفحة مسموحة للمستخدم
        is_admin = (self._current_user.get("role") == "admin")
        first_page = 0
        for idx, (_, _title) in enumerate(self._page_frames):
            pk = NAV_PERMISSIONS.get(idx)
            if idx == 3:          # صفحة الممرنين — admin فقط
                if is_admin:
                    first_page = idx
                    break
                continue
            if pk is None or is_admin:
                first_page = idx
                break
            if self._current_user.get("permissions", {}).get(pk, False):
                first_page = idx
                break
        self._navigate(first_page)

    # ──────────────────────────────────────────────────────────
    def _build_sidebar(self):
        sb = self.sidebar
        is_admin = (self._current_user.get("role") == "admin")

        # ── قسم اللوجو (أعلى) ──
        logo_area = tk.Frame(sb, bg=COLOR_HEADER, padx=0, pady=16)
        logo_area.pack(fill="x", side="top")

        self._sidebar_logo = None
        logo_shown = False
        for lp in [
            os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "attached_assets",
                         "WhatsApp_Image_2026-05-01_at_18.32.38_1777665526194.jpeg"),
            os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "attached_assets",
                         "WhatsApp_Image_2026-05-01_at_18.32.38_1777660833359.jpeg"),
        ]:
            if HAS_PIL and os.path.exists(lp) and not logo_shown:
                try:
                    from PIL import ImageDraw
                    size = 88
                    img  = Image.open(lp).convert("RGBA").resize((size, size), Image.LANCZOS)
                    mask = Image.new("L", (size, size), 0)
                    ImageDraw.Draw(mask).ellipse((0, 0, size-1, size-1), fill=255)
                    out  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
                    out.paste(img, (0, 0), mask=mask)
                    self._sidebar_logo = ImageTk.PhotoImage(out)
                    tk.Label(logo_area, image=self._sidebar_logo,
                             bg=COLOR_HEADER).pack(pady=(0, 6))
                    logo_shown = True
                except Exception:
                    pass

        if not logo_shown:
            tk.Label(logo_area, text="🚗", font=(FONT_FAMILY, 34),
                     bg=COLOR_HEADER, fg=COLOR_ACCENT).pack(pady=(0, 4))

        tk.Label(logo_area, text=T("brand_name"),
                 font=(FONT_FAMILY, 17, "bold"),
                 bg=COLOR_HEADER, fg="white").pack()
        tk.Label(logo_area, text=T("sidebar_subtitle"),
                 font=(FONT_FAMILY, 9),
                 bg=COLOR_HEADER, fg="#94a3b8").pack(pady=(2, 0))

        # فاصل أعلى
        tk.Frame(sb, bg="#334155", height=1).pack(fill="x", padx=14, pady=(0, 6), side="top")

        # ── التذييل السفلي: يُحجز أولاً بـ side="bottom" قبل أن يتوسع nav_container ──
        # هذا يضمن ظهوره دائماً بغض النظر عن ارتفاع الشاشة

        bot = tk.Frame(sb, bg=COLOR_HEADER, padx=12, pady=10)
        bot.pack(fill="x", side="bottom")

        # بيانات المستخدم الحالي
        user_row = tk.Frame(bot, bg=COLOR_HEADER)
        user_row.pack(fill="x", pady=(0, 8))
        tk.Label(user_row, text="👤", font=(FONT_FAMILY, 16),
                 bg=COLOR_HEADER, fg=COLOR_ACCENT).pack(side="left")
        ubox = tk.Frame(user_row, bg=COLOR_HEADER)
        ubox.pack(side="left", padx=(8, 0))
        display_name = (self._current_user.get("full_name")
                        or self._current_user.get("username", T("sidebar_user_def")))
        role_label   = T("sidebar_role_admin") if is_admin else T("sidebar_role_train")
        tk.Label(ubox, text=display_name,
                 font=(FONT_FAMILY, 10, "bold"),
                 bg=COLOR_HEADER, fg="white", anchor="w").pack(anchor="w")
        tk.Label(ubox, text=role_label,
                 font=(FONT_FAMILY, 8),
                 bg=COLOR_HEADER, fg="#64748b", anchor="w").pack(anchor="w")

        # زر تبديل اللغة
        new_lang = "fr" if LANG == "ar" else "ar"
        lang_btn = tk.Frame(bot, bg="#0369a1", cursor="hand2")
        lang_btn.pack(fill="x", pady=(4, 0))
        tk.Label(lang_btn, text=T("btn_lang_switch"),
                 font=(FONT_FAMILY, 9, "bold"),
                 bg="#0369a1", fg="white", pady=5, anchor="center").pack(fill="x")
        def _do_lang(e=None, _nl=new_lang):
            set_language(_nl)
            self._rebuild_ui()
        lang_btn.bind("<Button-1>", _do_lang)
        for ch in lang_btn.winfo_children():
            ch.bind("<Button-1>", _do_lang)
        def _lang_hover(e):
            lang_btn.configure(bg="#0284c7")
            for ch in lang_btn.winfo_children(): ch.configure(bg="#0284c7")
        def _lang_leave(e):
            lang_btn.configure(bg="#0369a1")
            for ch in lang_btn.winfo_children(): ch.configure(bg="#0369a1")
        lang_btn.bind("<Enter>", _lang_hover)
        lang_btn.bind("<Leave>", _lang_leave)

        # زر تسجيل الخروج
        logout_btn = tk.Frame(bot, bg="#ef4444", cursor="hand2")
        logout_btn.pack(fill="x", pady=(4, 0))
        tk.Label(logout_btn, text=T("btn_logout"),
                 font=(FONT_FAMILY, 10, "bold"),
                 bg="#ef4444", fg="white", pady=7, anchor="center").pack(fill="x")
        def _do_logout(e=None):
            if messagebox.askyesno(T("msg_logout_title"), T("msg_logout_q")):
                self.root.destroy()
                LoginWindow()
        logout_btn.bind("<Button-1>", _do_logout)
        for ch in logout_btn.winfo_children():
            ch.bind("<Button-1>", _do_logout)
        def _logout_hover(e):
            logout_btn.configure(bg="#dc2626")
            for ch in logout_btn.winfo_children(): ch.configure(bg="#dc2626")
        def _logout_leave(e):
            logout_btn.configure(bg="#ef4444")
            for ch in logout_btn.winfo_children(): ch.configure(bg="#ef4444")
        logout_btn.bind("<Enter>", _logout_hover)
        logout_btn.bind("<Leave>", _logout_leave)

        # تاريخ وإصدار
        tk.Label(bot, text=f"📅 {date.today().strftime('%Y-%m-%d')}  |  v2.0  🇩🇿",
                 font=(FONT_FAMILY, 8), bg=COLOR_HEADER, fg="#475569",
                 anchor="w").pack(fill="x", pady=(8, 0))

        # ── الفاصل فوق bot — يُحجز قبل nav_container (side="bottom") ──
        tk.Frame(sb, bg="#334155", height=1).pack(fill="x", padx=10, pady=(6, 0),
                                                   side="bottom")

        # ── زر إدارة المستخدمين (للمدير فقط) — side="bottom" ──
        if is_admin:
            users_btn = tk.Frame(sb, bg=COLOR_PURPLE, cursor="hand2", padx=10, pady=6)
            users_btn.pack(fill="x", padx=8, pady=(0, 4), side="bottom")
            tk.Label(users_btn, text=T("btn_users"),
                     font=(FONT_FAMILY, 9, "bold"),
                     bg=COLOR_PURPLE, fg="white").pack()
            def _open_users(e=None):
                UserManagementDialog(self.root,
                                     current_user_id=self._current_user.get("id"))
            users_btn.bind("<Button-1>", _open_users)
            for ch in users_btn.winfo_children():
                ch.bind("<Button-1>", _open_users)
            def _users_hover(e):
                users_btn.configure(bg="#7c3aed")
                for ch in users_btn.winfo_children(): ch.configure(bg="#7c3aed")
            def _users_leave(e):
                users_btn.configure(bg=COLOR_PURPLE)
                for ch in users_btn.winfo_children(): ch.configure(bg=COLOR_PURPLE)
            users_btn.bind("<Enter>", _users_hover)
            users_btn.bind("<Leave>", _users_leave)

        # ── الفاصل فوق زر المستخدمين — side="bottom" ──
        tk.Frame(sb, bg="#334155", height=1).pack(fill="x", padx=14, pady=6,
                                                   side="bottom")

        # ── عناصر التنقل — منطقة قابلة للتمرير تملأ المساحة المتبقية ──
        nav_outer = tk.Frame(sb, bg=COLOR_SIDEBAR)
        nav_outer.pack(fill="both", expand=True, side="top")

        nav_canvas = tk.Canvas(nav_outer, bg=COLOR_SIDEBAR,
                               highlightthickness=0, bd=0)
        nav_canvas.pack(side="left", fill="both", expand=True)
        self._nav_canvas = nav_canvas

        nav_container = tk.Frame(nav_canvas, bg=COLOR_SIDEBAR)
        nav_win = nav_canvas.create_window((0, 0), window=nav_container, anchor="nw")

        def _nav_configure(e):
            nav_canvas.configure(scrollregion=nav_canvas.bbox("all"))
        def _nav_canvas_resize(e):
            nav_canvas.itemconfig(nav_win, width=e.width)
        nav_container.bind("<Configure>", _nav_configure)
        nav_canvas.bind("<Configure>", _nav_canvas_resize)

        def _nav_mousewheel(e):
            nav_canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        nav_canvas.bind("<MouseWheel>", _nav_mousewheel)
        nav_container.bind("<MouseWheel>", _nav_mousewheel)

        nav_defs = [
            ("🏠", T("nav_dashboard")),
            ("🏫", T("nav_school_info")),
            ("🧾", T("nav_candidates")),
            ("🚗", T("nav_instructors")),
            ("📚", T("nav_training")),
            ("📅", T("nav_schedule")),
            ("💰", T("nav_payments")),
            ("💸", T("nav_expenses")),
            ("📊", T("nav_reports")),
            ("🖨️", T("nav_documents")),
            ("🎓", T("nav_graduates")),
        ]
        self._nav_refs = []
        for i, (icon, label) in enumerate(nav_defs):
            self._make_nav_item(nav_container, icon, label, i)
            perm_key = NAV_PERMISSIONS.get(i)
            visible  = True
            if perm_key is None:
                if i == 3 and not is_admin:
                    visible = False
            else:
                visible = is_admin or bool(
                    self._current_user.get("permissions", {}).get(perm_key, False))
            if not visible:
                self._nav_refs[i]["outer"].pack_forget()

    def _make_nav_item(self, parent, icon, label, index):
        outer = tk.Frame(parent, bg=COLOR_SIDEBAR, cursor="hand2")
        outer.pack(fill="x")

        # شريط اللون النشط — يتكيف مع اتجاه اللغة
        accent = tk.Frame(outer, bg=COLOR_SIDEBAR, width=4)
        accent.pack(side=S(), fill="y")

        inner = tk.Frame(outer, bg=COLOR_SIDEBAR, padx=12, pady=7)
        inner.pack(side=So(), fill="both", expand=True)

        icon_lbl = tk.Label(inner, text=icon, font=(FONT_FAMILY, 12),
                            bg=COLOR_SIDEBAR, fg="#64748b")
        icon_lbl.pack(side=S(), padx=(0, 8))

        text_lbl = tk.Label(inner, text=label, font=(FONT_FAMILY, 10, "bold"),
                            bg=COLOR_SIDEBAR, fg="#94a3b8", anchor=A())
        text_lbl.pack(side=S(), fill="x", expand=True)

        ref = {"outer": outer, "inner": inner,
               "icon": icon_lbl, "text": text_lbl, "accent": accent}
        self._nav_refs.append(ref)

        for w in [outer, inner, icon_lbl, text_lbl]:
            w.bind("<Enter>",       lambda e, i=index: self._nav_hover(i))
            w.bind("<Leave>",       lambda e, i=index: self._nav_leave(i))
            w.bind("<Button-1>",    lambda e, i=index: self._navigate(i))
            w.bind("<MouseWheel>",  lambda e: self._nav_scroll(e))

    def _nav_hover(self, index):
        if index == self._current_idx:
            return
        r = self._nav_refs[index]
        for w in [r["outer"], r["inner"]]:
            w.configure(bg=COLOR_SIDEBAR_HOVER)
        r["icon"].configure(bg=COLOR_SIDEBAR_HOVER, fg="#cbd5e1")
        r["text"].configure(bg=COLOR_SIDEBAR_HOVER, fg="#e2e8f0")

    def _nav_scroll(self, event):
        """تمرير قائمة التنقل بعجلة الماوس."""
        try:
            self._nav_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        except Exception:
            pass

    def _nav_leave(self, index):
        if index == self._current_idx:
            return
        r = self._nav_refs[index]
        for w in [r["outer"], r["inner"]]:
            w.configure(bg=COLOR_SIDEBAR)
        r["icon"].configure(bg=COLOR_SIDEBAR, fg="#64748b")
        r["text"].configure(bg=COLOR_SIDEBAR, fg="#94a3b8")

    def _navigate(self, index):
        # فحص الصلاحية قبل التنقل
        is_admin = (self._current_user.get("role") == "admin")
        perm_key = NAV_PERMISSIONS.get(index)
        if index == 3 and not is_admin:
            return
        if perm_key and not is_admin:
            if not self._current_user.get("permissions", {}).get(perm_key, False):
                messagebox.showwarning(T("msg_perm_title"),
                                       T("msg_perm_denied"),
                                       parent=self.root)
                return

        # إلغاء تفعيل الصفحة الحالية
        if 0 <= self._current_idx < len(self._nav_refs):
            old = self._nav_refs[self._current_idx]
            for w in [old["outer"], old["inner"]]:
                w.configure(bg=COLOR_SIDEBAR)
            old["icon"].configure(bg=COLOR_SIDEBAR, fg="#64748b")
            old["text"].configure(bg=COLOR_SIDEBAR, fg="#94a3b8")
            old["accent"].configure(bg=COLOR_SIDEBAR)

        # إخفاء كل الصفحات
        for frame, _ in self._page_frames:
            frame.pack_forget()

        # تفعيل الصفحة الجديدة
        self._current_idx = index
        ref = self._nav_refs[index]
        for w in [ref["outer"], ref["inner"]]:
            w.configure(bg="#1e3a8a")
        ref["icon"].configure(bg="#1e3a8a", fg="white")
        ref["text"].configure(bg="#1e3a8a", fg="white")
        ref["accent"].configure(bg=COLOR_ACCENT)

        if 0 <= index < len(self._page_frames):
            frame, title = self._page_frames[index]
            frame.pack(fill="both", expand=True)
            if self._topbar_title:
                self._topbar_title.configure(text=title)

    # ──────────────────────────────────────────────────────────
    def _build_topbar(self, parent):
        topbar = tk.Frame(parent, bg=COLOR_CARD, padx=20, pady=0)
        topbar.pack(fill="x", side="top")
        tk.Frame(parent, bg=COLOR_BORDER, height=1).pack(fill="x")

        inner = tk.Frame(topbar, bg=COLOR_CARD, pady=11)
        inner.pack(fill="both")

        # يمين: عنوان الصفحة
        right_bar = tk.Frame(inner, bg=COLOR_CARD)
        right_bar.pack(side="right")
        self._topbar_title = tk.Label(right_bar, text=T("topbar_home"),
                                       font=(FONT_FAMILY, 17, "bold"),
                                       bg=COLOR_CARD, fg=COLOR_HEADER, anchor=A())
        self._topbar_title.pack(side="right")

        # يسار: التاريخ + التنبيهات
        left_bar = tk.Frame(inner, bg=COLOR_CARD)
        left_bar.pack(side="left")

        try:
            v_alerts = VehicleDB.get_alerts()
            cands    = CandidateDB.get_all()
            unpaid   = [c for c in cands
                        if sum(p["amount"] for p in PaymentDB.get_by_candidate(c["id"]))
                        < c["total_amount"]]
            ac = len(v_alerts) + (1 if unpaid else 0)
        except Exception:
            ac = 0

        bell_clr  = COLOR_DANGER if ac > 0 else COLOR_TEXT_LIGHT
        bell_text = f"🔔 {ac}" if ac > 0 else "🔔"
        tk.Label(left_bar, text=bell_text, font=(FONT_FAMILY, 13),
                 bg=COLOR_CARD, fg=bell_clr, cursor="hand2").pack(side="left", padx=(0, 14))

        today  = date.today()
        _months = MONTHS_FR if LANG == "fr" else MONTHS_AR
        d_str  = f"{today.day} {_months.get(today.strftime('%m'), '')} {today.year}"
        tk.Label(left_bar, text=f"📅  {d_str}", font=(FONT_FAMILY, 11),
                 bg=COLOR_CARD, fg=COLOR_TEXT_LIGHT).pack(side="left")

    # ──────────────────────────────────────────────────────────
    def _build_frames(self):
        nav_defs = [
            (T("nav_dashboard"),   DashboardFrame),
            (T("nav_school_info"), SchoolInfoFrame),
            (T("nav_candidates"),  CandidatesFrame),
            (T("nav_instructors"), InstructorsFrame),
            (T("nav_training"),    TrainingFrame),
            (T("nav_schedule"),    ScheduleFrame),
            (T("nav_payments"),    PaymentsFrame),
            (T("nav_expenses"),    ExpensesFrame),
            (T("nav_reports"),     ReportsFrame),
            (T("nav_documents"),   DocumentsFrame),
            (T("nav_graduates"),   GraduatesFrame),
        ]
        # يحتاج DashboardFrame وReportsFrame لـ callback للتنقل
        navigate_aware = (DashboardFrame, ReportsFrame)
        self._page_frames = []
        for title, FrameClass in nav_defs:
            if FrameClass in navigate_aware:
                f = FrameClass(self.content, navigate_cb=self._navigate)
            else:
                f = FrameClass(self.content)
            f.pack_forget()
            self._page_frames.append((f, title))

    # ──────────────────────────────────────────────────────────
    def _rebuild_ui(self):
        """يُعيد بناء الواجهة بالكامل في نفس النافذة بعد تغيير اللغة،
        دون إعادة تشغيل البرنامج أو فقدان جلسة تسجيل الدخول."""
        saved_idx = self._current_idx

        # تدمير كل عناصر النافذة الجذر
        for widget in self.root.winfo_children():
            widget.destroy()

        # إعادة تهيئة متغيرات الحالة
        self._nav_refs     = []
        self._current_idx  = -1
        self._page_frames  = []
        self._topbar_title = None
        self._sidebar_logo = None

        # إعادة بناء الواجهة بالكامل بالنص الجديد
        self.root.title(T("app_title"))
        self._setup_styles()
        self._build_layout()
        self._build_status_bar()

        # العودة للصفحة التي كان المستخدم يراها
        target = saved_idx if 0 <= saved_idx < len(self._page_frames) else 0
        if target != 0:
            self._navigate(target)

    # ──────────────────────────────────────────────────────────
    def _build_status_bar(self):
        bar = tk.Frame(self.root, bg=COLOR_HEADER, padx=15, pady=5)
        bar.pack(fill="x", side="bottom")
        nc = len(CandidateDB.get_all())
        ni = len(InstructorDB.get_all())
        ar_s  = T("bar_arabic_ok") if HAS_ARABIC_LIBS  else T("bar_arabic_err")
        pdf_s = "PDF ✓"            if HAS_REPORTLAB    else "PDF ✗"
        tk.Label(bar,
                 text=f"{T('bar_candidates')} {nc}   |   {T('bar_instructors')} {ni}   |   {pdf_s}   |   {ar_s}   |   {T('bar_db')}",
                 font=FONT_SMALL, bg=COLOR_HEADER, fg="white").pack(side="right")
        tk.Label(bar, text=f"v2.0  |  {T('bar_brand')}",
                 font=FONT_SMALL, bg=COLOR_HEADER, fg="#94a3b8").pack(side="left")
        tk.Label(bar, text="📞 +213540772807   |   WhatsApp +213540772807   |   ✉ contact@midanic.com",
                 font=FONT_SMALL, bg=COLOR_HEADER, fg="#94a3b8").pack(side="left", padx=(20, 0))

    pass  # placeholder — الأساليب القديمة أُزيلت


if __name__ == "__main__":
    # تحميل اللغة المحفوظة قبل إنشاء أي نافذة
    import os as _os, sys as _sys
    # نضمن أن init_db وupgrade_db تعملان قبل قراءة اللغة
    _tmp_conn = get_connection()
    _tmp_conn.executescript("""
        CREATE TABLE IF NOT EXISTS school_info (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            name TEXT DEFAULT '', commercial_register TEXT DEFAULT '',
            accreditation_number TEXT DEFAULT '', nif TEXT DEFAULT '',
            nis TEXT DEFAULT '', article_number TEXT DEFAULT '',
            address TEXT DEFAULT '', phone TEXT DEFAULT ''
        );
        INSERT OR IGNORE INTO school_info (id) VALUES (1);
    """)
    _tmp_conn.commit()
    _tmp_conn.close()
    upgrade_db()
    LANG = get_language()

    # ── فحص الترخيص قبل فتح البرنامج ─────────────────────────────────
    try:
        from license_guard import check_license
        import tkinter as _tk_lic
        _lic_root = _tk_lic.Tk()
        _lic_root.withdraw()          # نخفي النافذة المؤقتة
        _lic_ok = check_license(_lic_root)
        _lic_root.destroy()
        if not _lic_ok:
            raise SystemExit("البرنامج غير مفعّل.")
    except ImportError as exc:
        # لا تسمح بتشغيل نسخة العميل بدون نظام الترخيص.
        raise SystemExit(
            "تعذر تحميل نظام الترخيص. أعد بناء البرنامج مع license_guard.py."
        ) from exc
    # ──────────────────────────────────────────────────────────────────

    LoginWindow()
