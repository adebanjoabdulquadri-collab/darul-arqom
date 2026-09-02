export const DEMO_PROFILES = {
  student: {
    userId: "student-salman-01",
    name: "Salman Farooq",
    email: "salman.f@madrasa.org",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    role: "student",
    points: 450,
    streakDays: 12,
  },
  instructor: {
    userId: "inst-alfarsi-01",
    name: "Shaykh Dr. Tariq Al-Farsi",
    email: "tariq@daarularkom.org",
    avatar:
      "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&h=200&fit=crop",
    role: "instructor",
    points: 2500,
    streakDays: 30,
  },
};

export async function initializeDatabase() {
  return true;
}

export function subscribeCourses(callback) {
  callback([]);
  return () => {};
}
export function subscribeEnrollments(userId, callback) {
  callback([]);
  return () => {};
}
export function subscribeAssignments(callback) {
  callback([]);
  return () => {};
}
export function subscribeLiveSessions(callback) {
  callback([]);
  return () => {};
}
export function subscribeRecitationBookmarks(userId, callback) {
  callback([]);
  return () => {};
}
export function subscribeUserProfile(userId, callback) {
  callback(null);
  return () => {};
}
export function subscribeAllEnrollments(callback) {
  callback([]);
  return () => {};
}
export function subscribeAllUsers(callback) {
  callback([]);
  return () => {};
}
export async function enrollInCourse(userId, courseId) {
  return true;
}
export async function toggleLessonCompletion(userId, courseId, lessonId) {
  return true;
}
export async function submitRecitationAssignment(data) {
  return true;
}
export async function gradeRecitationAssignment(id, score, feedback) {
  return true;
}
export async function rsvpLiveSession(sessionId, userId) {
  return true;
}
export async function saveAyahBookmark(data) {
  return true;
}
export async function deleteAyahBookmark(id) {
  return true;
}
export async function signInWithGoogle() {
  return { user: null, profile: null };
}
export async function signOutUser() {
  return true;
}
export function onAuthChange(callback) {
  callback(null, null);
}
export async function updateUserProfileDB(userId, data) {
  return true;
}
export async function updateEnrollmentStatusDB(id, status) {
  return true;
}
export async function createLiveSessionDB(data) {
  return true;
}
export async function createCourseDB(data) {
  return true;
}
