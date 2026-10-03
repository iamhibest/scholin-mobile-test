import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { colors, fonts } from '../theme';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SplashScreen from '../screens/SplashScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ParentLoginScreen from '../screens/ParentLoginScreen';
import ParentRegisterScreen from '../screens/ParentRegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import TermsScreen from '../screens/TermsScreen';
import StaffHomeScreen from '../screens/StaffHomeScreen';
import ParentHomeScreen from '../screens/ParentHomeScreen';
import SuperAdminHomeScreen from '../screens/SuperAdminHomeScreen';
import FeatureScreen from '../screens/FeatureScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RegisterSchoolScreen from '../screens/RegisterSchoolScreen';
import JoinSchoolScreen from '../screens/JoinSchoolScreen';
import PendingApprovalScreen from '../screens/PendingApprovalScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import DeveloperScreen from '../screens/DeveloperScreen';
import LogsScreen from '../screens/LogsScreen';
import ScanTestScreen from '../screens/ScanTestScreen';
import LocationTestScreen from '../screens/LocationTestScreen';
import PushTestScreen from '../screens/PushTestScreen';
import PdfTestScreen from '../screens/PdfTestScreen';
import StudentsScreen from '../screens/StudentsScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import StudentFormScreen from '../screens/StudentFormScreen';
import TeachersScreen from '../screens/TeachersScreen';
import TeacherEditScreen from '../screens/TeacherEditScreen';
import { PortalSessionsScreen, PortalTermsScreen } from '../screens/PortalScreen';
import PortalClassesScreen from '../screens/PortalClassesScreen';
import ClassWorkspaceScreen from '../screens/ClassWorkspaceScreen';
import ClassResultsScreen from '../screens/ClassResultsScreen';
import ClassReportCardsScreen from '../screens/ClassReportCardsScreen';
import ReportCardViewScreen from '../screens/ReportCardViewScreen';
import ClassCommentsScreen from '../screens/ClassCommentsScreen';
import ClassSubjectsScreen from '../screens/ClassSubjectsScreen';
import ArrangeSubjectsScreen from '../screens/ArrangeSubjectsScreen';
import RemoveFromExamScreen from '../screens/RemoveFromExamScreen';
import PublishReportsScreen from '../screens/PublishReportsScreen';
import ClassSettingsScreen from '../screens/ClassSettingsScreen';
import AttendanceSummaryScreen from '../screens/AttendanceSummaryScreen';
import ClassFormScreen from '../screens/ClassFormScreen';
import SubjectsScreen from '../screens/SubjectsScreen';
import AutoCommentsScreen from '../screens/AutoCommentsScreen';
import ArchivedSessionsScreen from '../screens/ArchivedSessionsScreen';
import PromotionScreen from '../screens/PromotionScreen';
import MigrationScreen from '../screens/MigrationScreen';
import SessionsTermsScreen from '../screens/SessionsTermsScreen';
import ReportTemplatesScreen from '../screens/ReportTemplatesScreen';
import TemplatePreviewScreen from '../screens/TemplatePreviewScreen';
import TemplateCustomizeScreen from '../screens/TemplateCustomizeScreen';
import QrCodesScreen from '../screens/QrCodesScreen';
import StaffAttendanceScreen from '../screens/StaffAttendanceScreen';
import StaffAttendanceDetailScreen from '../screens/StaffAttendanceDetailScreen';
import StudentAttendanceScreen from '../screens/StudentAttendanceScreen';
import SchoolSettingsScreen from '../screens/SchoolSettingsScreen';
import ClockScreen from '../screens/ClockScreen';
import ClassAttendanceScreen from '../screens/ClassAttendanceScreen';
import MyClassesScreen from '../screens/MyClassesScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const headerOptions = {
  headerShown: true,
  headerTintColor: colors.primary,
  headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
};

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ParentLogin" component={ParentLoginScreen} />
      <Stack.Screen name="ParentRegister" component={ParentRegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ ...headerOptions, title: 'Terms and About' }} />
      <Stack.Screen name="Home" component={StaffHomeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="ParentHome" component={ParentHomeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="SuperAdminHome" component={SuperAdminHomeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Feature" component={FeatureScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="RegisterSchool" component={RegisterSchoolScreen} />
      <Stack.Screen name="JoinSchool" component={JoinSchoolScreen} />
      <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Students" component={StudentsScreen} options={{ ...headerOptions, title: 'Students' }} />
      <Stack.Screen name="StudentDetail" component={StudentDetailScreen} options={{ ...headerOptions, title: 'Student' }} />
      <Stack.Screen name="StudentForm" component={StudentFormScreen} options={{ ...headerOptions, title: 'Add student' }} />
      <Stack.Screen name="Teachers" component={TeachersScreen} options={{ ...headerOptions, title: 'Teachers and Roles' }} />
      <Stack.Screen name="TeacherEdit" component={TeacherEditScreen} options={{ ...headerOptions, title: 'Edit teacher' }} />
      <Stack.Screen name="Portal" component={PortalSessionsScreen} options={{ ...headerOptions, title: 'School Portal' }} />
      <Stack.Screen name="PortalTerms" component={PortalTermsScreen} options={{ ...headerOptions, title: 'Terms' }} />
      <Stack.Screen name="PortalClasses" component={PortalClassesScreen} options={{ ...headerOptions, title: 'Classes' }} />
      <Stack.Screen name="ClassDetail" component={ClassWorkspaceScreen} options={{ ...headerOptions, title: 'Class' }} />
      <Stack.Screen name="ClassForm" component={ClassFormScreen} options={{ ...headerOptions, title: 'Add class' }} />
      <Stack.Screen name="Clock" component={ClockScreen} options={{ ...headerOptions, title: 'Clock In and Out' }} />
      <Stack.Screen name="ClassAttendance" component={ClassAttendanceScreen} options={{ ...headerOptions, title: 'Attendance' }} />
      <Stack.Screen name="MyClasses" component={MyClassesScreen} options={{ ...headerOptions, title: 'My Classes' }} />
      <Stack.Screen name="ClassResults" component={ClassResultsScreen} options={{ ...headerOptions, title: 'Edit / Add Results' }} />
      <Stack.Screen name="ClassReportCards" component={ClassReportCardsScreen} options={{ ...headerOptions, title: 'Report Cards' }} />
      <Stack.Screen name="ReportCardView" component={ReportCardViewScreen} options={{ ...headerOptions, title: 'Report Card' }} />
      <Stack.Screen name="ClassComments" component={ClassCommentsScreen} options={{ ...headerOptions, title: 'Comments and Ratings' }} />
      <Stack.Screen name="ClassSubjects" component={ClassSubjectsScreen} options={{ ...headerOptions, title: 'Class Subjects' }} />
      <Stack.Screen name="ArrangeSubjects" component={ArrangeSubjectsScreen} options={{ ...headerOptions, title: 'Arrange Subjects' }} />
      <Stack.Screen name="RemoveFromExam" component={RemoveFromExamScreen} options={{ ...headerOptions, title: 'Remove Student from Exam' }} />
      <Stack.Screen name="PublishReports" component={PublishReportsScreen} options={{ ...headerOptions, title: 'Publish Report Cards' }} />
      <Stack.Screen name="ClassSettings" component={ClassSettingsScreen} options={{ ...headerOptions, title: 'Class Settings' }} />
      <Stack.Screen name="AttendanceSummary" component={AttendanceSummaryScreen} options={{ ...headerOptions, title: 'Weekly Summary' }} />
      <Stack.Screen name="Subjects" component={SubjectsScreen} options={{ ...headerOptions, title: 'Subjects' }} />
      <Stack.Screen name="AutoComments" component={AutoCommentsScreen} options={{ ...headerOptions, title: 'Auto Comments' }} />
      <Stack.Screen name="ArchivedSessions" component={ArchivedSessionsScreen} options={{ ...headerOptions, title: 'Archived Sessions' }} />
      <Stack.Screen name="Promotion" component={PromotionScreen} options={{ ...headerOptions, title: 'Student Promotion' }} />
      <Stack.Screen name="Migration" component={MigrationScreen} options={{ ...headerOptions, title: 'Student Migration' }} />
      <Stack.Screen name="SessionsTerms" component={SessionsTermsScreen} options={{ ...headerOptions, title: 'Sessions and Terms' }} />
      <Stack.Screen name="ReportTemplates" component={ReportTemplatesScreen} options={{ ...headerOptions, title: 'Report Card Templates' }} />
      <Stack.Screen name="TemplatePreview" component={TemplatePreviewScreen} options={{ ...headerOptions, title: 'Preview' }} />
      <Stack.Screen name="TemplateCustomize" component={TemplateCustomizeScreen} options={{ ...headerOptions, title: 'Customise' }} />
      <Stack.Screen name="QrCodes" component={QrCodesScreen} options={{ ...headerOptions, title: 'Attendance QR Codes' }} />
      <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} options={{ ...headerOptions, title: 'Staff Attendance' }} />
      <Stack.Screen name="StaffAttendanceDetail" component={StaffAttendanceDetailScreen} options={{ ...headerOptions, title: 'Attendance record' }} />
      <Stack.Screen name="StudentAttendance" component={StudentAttendanceScreen} options={{ ...headerOptions, title: 'Student Attendance' }} />
      <Stack.Screen name="SchoolSettings" component={SchoolSettingsScreen} options={{ ...headerOptions, title: 'School Settings' }} />
      <Stack.Screen name="Developer" component={DeveloperScreen} options={{ ...headerOptions, title: 'Developer tools' }} />
      <Stack.Screen name="Logs" component={LogsScreen} options={{ ...headerOptions, title: 'App logs' }} />
      <Stack.Screen name="Scan" component={ScanTestScreen} options={{ ...headerOptions, title: 'QR scan test' }} />
      <Stack.Screen name="Location" component={LocationTestScreen} options={{ ...headerOptions, title: 'Location test' }} />
      <Stack.Screen name="Push" component={PushTestScreen} options={{ ...headerOptions, title: 'Push test' }} />
      <Stack.Screen name="Pdf" component={PdfTestScreen} options={{ ...headerOptions, title: 'PDF test' }} />
    </Stack.Navigator>
  );
}
