import mongoose from "mongoose";
import SavedPlace, { SAVED_PLACE_TYPES } from "../models/SavedPlace.js";
import UserPreference from "../models/UserPreference.js";
import SupportReport, { SUPPORT_REPORT_CATEGORIES } from "../models/SupportReport.js";
import { assertRideParticipant, resolvePrincipal } from "../services/rideCommunicationPolicy.js";

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({
    success: false,
    code: error.code || "INTERNAL_ERROR",
    message: error.statusCode ? error.message : "Internal server error",
  });

class AccountError extends Error {
  constructor(message, statusCode = 400, code = "ACCOUNT_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const requirePassenger = async (req) => {
  const principal = await resolvePrincipal(req.user?._id);
  if (principal.role !== "passenger") {
    throw new AccountError("Passenger account required", 403, "PASSENGER_REQUIRED");
  }
  return principal;
};

const requireAccountOwner = async (req) => {
  const principal = await resolvePrincipal(req.user?._id);
  if (!["passenger", "driver"].includes(principal.role)) {
    throw new AccountError("Passenger or driver account required", 403, "ACCOUNT_OWNER_REQUIRED");
  }
  return principal;
};

const placeDto = (place) => ({
  id: String(place._id),
  type: place.type,
  name: place.name,
  address: place.address,
  lat: place.lat,
  long: place.long,
  category: place.category || "",
  createdAt: place.createdAt,
  updatedAt: place.updatedAt,
});

const preferenceDto = (preference) => ({
  language: preference.language || "en",
  notifications: {
    rideUpdates: preference.notifications?.rideUpdates !== false,
    messages: preference.notifications?.messages !== false,
    accountUpdates: preference.notifications?.accountUpdates !== false,
    sounds: preference.notifications?.sounds !== false,
    vibration: preference.notifications?.vibration !== false,
  },
});

const normalizePlaceInput = (body = {}) => {
  const type = String(body.type || "favorite").trim().toLowerCase();
  if (!SAVED_PLACE_TYPES.includes(type)) {
    throw new AccountError("Saved place type must be home, work, or favorite", 400, "INVALID_PLACE_TYPE");
  }
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  const address = String(body.address || "").trim().replace(/\s+/g, " ");
  const lat = Number(body.lat);
  const long = Number(body.long);
  const category = String(body.category || "").trim().slice(0, 40);
  if (!name) throw new AccountError("Place name is required", 400, "PLACE_NAME_REQUIRED");
  if (!address) throw new AccountError("Place address is required", 400, "PLACE_ADDRESS_REQUIRED");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new AccountError("Valid latitude is required", 400, "INVALID_LATITUDE");
  if (!Number.isFinite(long) || long < -180 || long > 180) throw new AccountError("Valid longitude is required", 400, "INVALID_LONGITUDE");
  return { type, name, address, lat, long, category };
};

const driverTermsBody = [
  "1. Registration and Documentation\nThe driver must provide accurate information and valid documents, including a valid Emirates ID, driving license, and any permits or documents required to provide the service in accordance with the applicable laws of the United Arab Emirates.\n\nDrewel reserves the right to request the driver to update or verify the documents and information provided at any time.",
  "2. Nature of the Drewel Platform\nDrewel operates as an electronic platform connecting users with independent drivers to facilitate the booking of driving services. Drewel is not the driver's employer, and these Terms and Conditions do not create an employment, partnership, or agency relationship between Drewel and the driver.\n\nThe driver provides the service independently and is responsible for complying with all applicable laws and regulations of the United Arab Emirates.",
  "3. Driver Responsibilities\nThe driver must comply with all traffic and safety laws and regulations in the United Arab Emirates, maintain their own safety and the safety of the user, and use the user's vehicle carefully and responsibly while providing the service.\n\nThe driver must also arrive at the user's location on time whenever reasonably possible, provide the agreed service professionally and respectfully, and must not use the vehicle for any purpose outside the scope of the requested service.",
  "4. Accepting Requests\nThe driver may accept or decline service requests.\n\nAfter accepting a request, the driver must complete the service or notify the user and Drewel as soon as possible if they are unable to do so.",
  "5. Payment\nThe service fee shall be paid directly by the user to the driver according to the agreed price or the price displayed in the application.\n\nThe driver may not request any additional amount from the user that has not been authorized or approved.\n\nIf any platform fee or commission is applicable in favor of Drewel, it will be communicated to the driver in accordance with the mechanism adopted by the application.",
  "6. Interaction with Users\nThe driver must treat users with respect and professionalism. Threatening, harassing, abusive, or inappropriate behavior is strictly prohibited.\n\nThe driver must not use or share the user's personal information for any purpose other than providing the requested service.",
  "7. Safety and Accidents\nThe driver is strictly prohibited from driving under the influence of alcohol, drugs, or any substance that may impair their ability to drive safely.\n\nIn the event of an accident while providing the service, the driver must ensure safety, notify the relevant authorities, and inform Drewel when required.\n\nLiability for any accident or damage shall be determined in accordance with the applicable laws of the United Arab Emirates and based on the circumstances of the incident and the relevant official reports.",
  "8. Vehicle, Personal Belongings and Liability\nThe driving service is provided using the user's vehicle. The user is responsible for ensuring that the vehicle is legally registered, roadworthy, and properly insured in accordance with the applicable laws.\n\nDrewel shall not be liable for any loss, damage, theft, or disappearance of any personal belongings or property of the user during or after the provision of the service, and Drewel shall not be a party to any claim or dispute relating to such property, to the extent permitted by the applicable laws of the United Arab Emirates.\n\nThe driver shall be responsible for any damage resulting from their negligence, misconduct, or improper use of the vehicle while providing the service.",
  "9. Account Suspension\nDrewel reserves the right to suspend or terminate the driver's account in cases including, but not limited to, providing false information or documents, fraud, misuse of the application, violation of these Terms and Conditions, unlawful conduct, or conduct that places others at risk.",
  "10. Application Use and Data\nManipulating requests or prices, creating fake accounts, attempting to hack or compromise the application, or accessing other users' data without authorization is prohibited.\n\nDriver and user data shall be processed and used in accordance with Drewel's Privacy Policy and the applicable laws and regulations of the United Arab Emirates.",
  "11. Amendments to the Terms and Conditions\nDrewel reserves the right to amend or update these Terms and Conditions when necessary. Drivers will be notified of any material changes through the application or other approved communication methods.",
  "12. Governing Law and Acceptance\nThese Terms and Conditions shall be governed by and interpreted in accordance with the applicable laws and regulations of the United Arab Emirates.\n\nBy clicking \"I Agree to the Terms and Conditions\" or by using the Drewel application, the driver confirms that they have read, understood, and agreed to these Terms and Conditions.",
].join("\n\n");

const driverTermsBodyAr = [
  "1. التسجيل والوثائق\nيجب على السائق تقديم معلومات صحيحة ووثائق سارية، بما في ذلك الهوية الإماراتية، رخصة القيادة، وأي تصاريح أو مستندات مطلوبة لتقديم الخدمة وفقاً للقوانين المعمول بها في دولة الإمارات العربية المتحدة.\n\nيحق لـ Drewel طلب تحديث أو التحقق من الوثائق والمعلومات المقدمة في أي وقت.",
  "2. طبيعة منصة Drewel\nتعمل Drewel كمنصة إلكترونية تربط بين المستخدمين والسائقين المستقلين لتسهيل طلب خدمات القيادة. ولا تعتبر Drewel جهة توظيف للسائق، ولا تنشئ هذه الشروط علاقة عمل أو شراكة بين Drewel والسائق.\n\nيقدم السائق الخدمة بصفته مستقلاً، ويتحمل مسؤولية الالتزام بالقوانين والأنظمة المعمول بها في دولة الإمارات العربية المتحدة.",
  "3. مسؤوليات السائق\nيلتزم السائق بقوانين المرور والسلامة في دولة الإمارات، والمحافظة على سلامته وسلامة المستخدم، واستخدام مركبة المستخدم بعناية ومسؤولية أثناء تقديم الخدمة.\n\nكما يلتزم السائق بالوصول إلى موقع المستخدم في الوقت المناسب قدر الإمكان، وتنفيذ الخدمة المتفق عليها باحترافية واحترام، وعدم استخدام المركبة لأي غرض خارج نطاق الخدمة المطلوبة.",
  "4. قبول الطلبات\nيمكن للسائق قبول أو رفض طلبات الخدمة.\n\nبعد قبول الطلب، يجب على السائق تنفيذ الخدمة أو إبلاغ المستخدم وDrewel في أقرب وقت ممكن في حال تعذر تنفيذها.",
  "5. الدفع\nيتم دفع قيمة الخدمة مباشرة من المستخدم إلى السائق وفقاً للسعر المتفق عليه أو السعر الظاهر في التطبيق.\n\nولا يجوز للسائق طلب مبالغ إضافية غير معتمدة من المستخدم.\n\nوفي حال تطبيق أي رسوم منصة أو عمولة لصالح Drewel، يتم توضيحها للسائق وفق الآلية المعتمدة في التطبيق.",
  "6. التعامل مع المستخدم\nيجب على السائق التعامل مع المستخدم باحترام ومهنية، ويمنع التهديد أو التحرش أو الإساءة أو أي سلوك غير لائق.\n\nكما يمنع استخدام أو مشاركة بيانات المستخدم لأي غرض خارج تقديم الخدمة.",
  "7. السلامة والحوادث\nيمنع على السائق القيادة تحت تأثير الكحول أو المخدرات أو أي مادة قد تؤثر على قدرته على القيادة بأمان.\n\nفي حال وقوع حادث أثناء تقديم الخدمة، يجب على السائق التأكد من السلامة وإبلاغ الجهات المختصة وDrewel عند الحاجة.\n\nيتم تحديد المسؤولية عن أي حادث أو ضرر وفق القوانين المعمول بها في دولة الإمارات العربية المتحدة وبناءً على ظروف الواقعة والتقارير الرسمية.",
  "8. المركبة والممتلكات والمسؤولية\nتتم خدمة القيادة باستخدام مركبة المستخدم، ويتحمل المستخدم مسؤولية صلاحية المركبة وتسجيلها وتأمينها وفق القوانين المعمول بها.\n\nلا تتحمل Drewel مسؤولية فقدان أو تلف أو سرقة أو ضياع أي ممتلكات أو أغراض شخصية للمستخدم أثناء أو بعد تقديم الخدمة، ولا تكون Drewel طرفاً في أي مطالبة أو نزاع يتعلق بهذه الممتلكات، وذلك وفقاً للقوانين المعمول بها في دولة الإمارات العربية المتحدة.\n\nكما يتحمل السائق مسؤولية أي ضرر ناتج عن إهماله أو سوء استخدامه للمركبة أثناء تقديم الخدمة.",
  "9. تعليق الحساب\nيحق لـ Drewel تعليق أو إلغاء حساب السائق في حال تقديم معلومات أو وثائق غير صحيحة، أو الاحتيال، أو إساءة استخدام التطبيق، أو مخالفة الشروط، أو السلوك غير القانوني، أو تعريض الآخرين للخطر.",
  "10. استخدام التطبيق والبيانات\nيمنع التلاعب بالطلبات أو الأسعار، أو إنشاء حسابات وهمية، أو محاولة اختراق التطبيق، أو الوصول إلى بيانات الآخرين دون تصريح.\n\nويتم استخدام بيانات السائق والمستخدم وفقاً لسياسة الخصوصية والقوانين المعمول بها في دولة الإمارات العربية المتحدة.",
  "11. تعديل الشروط والأحكام\nتحتفظ Drewel بحق تعديل أو تحديث هذه الشروط والأحكام عند الحاجة، ويتم إشعار السائق بأي تغييرات جوهرية عبر التطبيق أو الوسائل المعتمدة.",
  "12. القانون والموافقة\nتخضع هذه الشروط للقوانين والأنظمة المعمول بها في دولة الإمارات العربية المتحدة.\n\nبالضغط على \"أوافق على الشروط والأحكام\" أو استخدام تطبيق Drewel، يؤكد السائق أنه قرأ وفهم ووافق على هذه الشروط والأحكام.",
].join("\n\n");

const defaultLegalBody = (type, language = "en") => {
  const isArabic = String(language || "").trim().toLowerCase().startsWith("ar");
  if (type === "privacy") {
    return [
      "Drewel uses account, contact, location, ride, payment-status, communication, and device data to provide the transport marketplace safely.",
      "Location data is used for pickup, destination, driver discovery, route, safety, and support workflows. Secure ride chat is used only for Drewel ride coordination and support.",
      "Drewel limits access to personal data to authorized operations, support, security, and administration workflows. Contact support if you need help with account data or privacy questions.",
    ].join("\n\n");
  }
  if (type === "driver-terms") {
    return isArabic ? driverTermsBodyAr : driverTermsBody;
  }
  return [
    "By using Drewel, passengers and drivers agree to use the marketplace honestly, safely, and only for lawful transport coordination.",
    "Passengers send ride requests, and drivers send official trip offers through Drewel. Prices, ride lifecycle changes, points, restrictions, and sensitive actions are controlled by the server.",
    "Drewel may restrict accounts, cancel unsafe activity, preserve ride and communication evidence, and require driver profile or document review when needed for marketplace safety.",
  ].join("\n\n");
};

export const listSavedPlaces = async (req, res) => {
  try {
    const principal = await requirePassenger(req);
    const places = await SavedPlace.find({ userId: principal.id }).sort({ type: 1, updatedAt: -1 });
    return res.json({ success: true, places: places.map(placeDto) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const upsertSavedPlace = async (req, res) => {
  try {
    const principal = await requirePassenger(req);
    const input = normalizePlaceInput(req.body);
    const filter = input.type === "favorite" && mongoose.isValidObjectId(req.params.placeId)
      ? { _id: req.params.placeId, userId: principal.id }
      : input.type === "favorite"
        ? { _id: new mongoose.Types.ObjectId(), userId: principal.id }
        : { userId: principal.id, type: input.type };
    const place = await SavedPlace.findOneAndUpdate(
      filter,
      { $set: { ...input, userId: principal.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ success: true, place: placeDto(place) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteSavedPlace = async (req, res) => {
  try {
    const principal = await requirePassenger(req);
    if (!mongoose.isValidObjectId(req.params.placeId)) {
      throw new AccountError("Invalid saved place id", 400, "INVALID_PLACE_ID");
    }
    const deleted = await SavedPlace.findOneAndDelete({ _id: req.params.placeId, userId: principal.id });
    if (!deleted) throw new AccountError("Saved place not found", 404, "PLACE_NOT_FOUND");
    return res.json({ success: true, message: "Saved place deleted" });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getPreferences = async (req, res) => {
  try {
    const principal = await requireAccountOwner(req);
    const preference = await UserPreference.findOneAndUpdate(
      { userId: principal.id },
      { $setOnInsert: { userId: principal.id, actorRole: principal.role } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, preferences: preferenceDto(preference) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const principal = await requireAccountOwner(req);
    const update = {};
    if (req.body?.language !== undefined) {
      const language = String(req.body.language).trim().toLowerCase();
      if (!["en", "ar"].includes(language)) {
        throw new AccountError("Unsupported language", 400, "INVALID_LANGUAGE");
      }
      update.language = language;
    }
    if (req.body?.notifications && typeof req.body.notifications === "object") {
      for (const key of ["rideUpdates", "messages", "accountUpdates", "sounds", "vibration"]) {
        if (req.body.notifications[key] !== undefined) {
          update[`notifications.${key}`] = req.body.notifications[key] === true;
        }
      }
      update["notifications.rideUpdates"] = true;
    }
    const preference = await UserPreference.findOneAndUpdate(
      { userId: principal.id },
      { $set: update, $setOnInsert: { userId: principal.id, actorRole: principal.role } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, preferences: preferenceDto(preference) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createSupportReport = async (req, res) => {
  try {
    const principal = await requireAccountOwner(req);
    const category = String(req.body?.category || "").trim().toLowerCase();
    if (!SUPPORT_REPORT_CATEGORIES.includes(category)) {
      throw new AccountError("Invalid issue category", 400, "INVALID_REPORT_CATEGORY");
    }
    const description = String(req.body?.description || "").trim().replace(/\s+/g, " ");
    if (description.length < 10) {
      throw new AccountError("Please describe the issue in at least 10 characters", 400, "REPORT_DESCRIPTION_TOO_SHORT");
    }
    let rideId = null;
    if (req.body?.rideId) {
      if (!mongoose.isValidObjectId(req.body.rideId)) {
        throw new AccountError("Invalid ride id", 400, "INVALID_RIDE_ID");
      }
      const { ride } = await assertRideParticipant(principal, req.body.rideId);
      rideId = ride._id;
    }
    const report = await SupportReport.create({
      userId: principal.id,
      actorRole: principal.role,
      rideId,
      category,
      description,
    });
    return res.status(201).json({
      success: true,
      report: {
        id: String(report._id),
        rideId: report.rideId ? String(report.rideId) : null,
        category: report.category,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getLegalContent = async (req, res) => {
  try {
    // Public by design: the pre-login signup flow must be able to show terms
    // and privacy content before an account exists.
    const type = String(req.params.type || "").trim().toLowerCase();
    const language = String(req.query.language || req.query.lang || "en").trim().toLowerCase();
    if (!["privacy", "terms", "driver-terms"].includes(type)) {
      throw new AccountError("Invalid legal document", 400, "INVALID_LEGAL_TYPE");
    }
    const envKey =
      type === "privacy"
        ? "PRIVACY_CONTENT"
        : type === "driver-terms"
          ? language.startsWith("ar")
            ? "DRIVER_TERMS_CONTENT_AR"
            : "DRIVER_TERMS_CONTENT"
          : "TERMS_CONTENT";
    return res.json({
      success: true,
      legal: {
        type,
        title:
          type === "privacy"
            ? "Privacy"
            : type === "driver-terms"
              ? language.startsWith("ar")
                ? "شروط وأحكام السائق"
                : "Driver Terms and Conditions"
              : "Terms & Conditions",
        lastUpdated: process.env.LEGAL_LAST_UPDATED || null,
        body: String(process.env[envKey] || "").trim() || defaultLegalBody(type, language),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
