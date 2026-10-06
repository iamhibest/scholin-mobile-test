// Super admin "view as school" mode. While the school overview screen is open, every staff screen
// (teachers, students, classes, results and so on) works on the chosen school instead of the signed in user's own school.
let viewing: string | null = null;

export function enterSchoolView(schoolId: string) {
  viewing = schoolId;
}

export function exitSchoolView() {
  viewing = null;
}

export function getSchoolView() {
  return viewing;
}
