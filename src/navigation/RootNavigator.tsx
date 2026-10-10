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
import SettingsScreen from '../screens/SettingsScreen';
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
import QrPosterScreen from '../screens/QrPosterScreen';
import SuperAdminVacancyScreen from '../screens/SuperAdminVacancyScreen';
import SuperAdminSettingsScreen from '../screens/SuperAdminSettingsScreen';
import SuperAdminSchoolScreen from '../screens/SuperAdminSchoolScreen';
import SchoolOverviewScreen from '../screens/SchoolOverviewScreen';
import BirthdaysScreen from '../screens/BirthdaysScreen';
import BirthdayWishScreen from '../screens/BirthdayWishScreen';
import ParentBirthdayWishScreen from '../screens/ParentBirthdayWishScreen';
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
import SuperAdminSchoolViewScreen from '../screens/SuperAdminSchoolViewScreen';
import SuperAdminUsersScreen from '../screens/SuperAdminUsersScreen';
import SuperAdminSubscriptionPricingScreen from '../screens/SuperAdminSubscriptionPricingScreen';
import SuperAdminSubscriptionsScreen from '../screens/SuperAdminSubscriptionsScreen';
import PaymentHistoryScreen from '../screens/PaymentHistoryScreen';
import SuperAdminFinanceScreen from '../screens/SuperAdminFinanceScreen';
import SuperAdminReferralsScreen from '../screens/SuperAdminReferralsScreen';
import SuperAdminReferralDetailScreen from '../screens/SuperAdminReferralDetailScreen';
import SuperAdminCommissionTiersScreen from '../screens/SuperAdminCommissionTiersScreen';
import SuperAdminPaymentTermsScreen from '../screens/SuperAdminPaymentTermsScreen';
import SuperAdminBroadcastsScreen from '../screens/SuperAdminBroadcastsScreen';
import SuperAdminAppVersionScreen from '../screens/SuperAdminAppVersionScreen';
import SuperAdminTermsAboutScreen from '../screens/SuperAdminTermsAboutScreen';
import SuperAdminAttendanceScreen from '../screens/SuperAdminAttendanceScreen';
import SuperAdminUserScreen from '../screens/SuperAdminUserScreen';
import StaffAttendanceScreen from '../screens/StaffAttendanceScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import ClockFriendScreen from '../screens/ClockFriendScreen';
import ResultsStatusScreen from '../screens/ResultsStatusScreen';
import ActivityLogScreen from '../screens/ActivityLogScreen';
import ReferralScreen from '../screens/ReferralScreen';
import MyProfileScreen from '../screens/MyProfileScreen';
import MySchoolsScreen from '../screens/MySchoolsScreen';
import JoinAnotherSchoolScreen from '../screens/JoinAnotherSchoolScreen';
import RosterListScreen from '../screens/RosterListScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import AnnouncementDetailScreen from '../screens/AnnouncementDetailScreen';
import AdminAnnouncementsScreen from '../screens/AdminAnnouncementsScreen';
import VacanciesScreen from '../screens/VacanciesScreen';
import VacancyDetailScreen from '../screens/VacancyDetailScreen';
import PostVacancyScreen from '../screens/PostVacancyScreen';
import MyVacanciesScreen from '../screens/MyVacanciesScreen';
import EventsScreen from '../screens/EventsScreen';
import EventFormScreen from '../screens/EventFormScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ReceiptScreen from '../screens/ReceiptScreen';
import ParentFeeDetailScreen from '../screens/ParentFeeDetailScreen';
import PaymentCheckoutScreen from '../screens/PaymentCheckoutScreen';
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
      <Stack.Screen name="Terms" component={TermsScreen} options={{ ...headerOptions, title: 'Terms and Policies' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...headerOptions, title: 'Settings' }} />
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
      <Stack.Screen name="SuperAdminSettings" component={SuperAdminSettingsScreen} options={{ ...headerOptions, title: 'App settings' }} />
      <Stack.Screen name="SuperAdminSubPricing" component={SuperAdminSubscriptionPricingScreen} options={{ ...headerOptions, title: 'Subscription pricing' }} />
      <Stack.Screen name="SuperAdminSubscriptions" component={SuperAdminSubscriptionsScreen} options={{ ...headerOptions, title: 'Subscriptions' }} />
      <Stack.Screen name="SuperAdminBroadcasts" component={SuperAdminBroadcastsScreen} options={{ ...headerOptions, title: 'Broadcasts' }} />
      <Stack.Screen name="SuperAdminAppVersion" component={SuperAdminAppVersionScreen} options={{ ...headerOptions, title: 'App version' }} />
      <Stack.Screen name="SuperAdminTermsAbout" component={SuperAdminTermsAboutScreen} options={{ ...headerOptions, title: 'Terms and About' }} />
      <Stack.Screen name="SuperAdminAttendance" component={SuperAdminAttendanceScreen} options={{ ...headerOptions, title: 'Staff attendance' }} />
      <Stack.Screen name="SuperAdminReferrals" component={SuperAdminReferralsScreen} options={{ ...headerOptions, title: 'Referrals' }} />
      <Stack.Screen name="SuperAdminReferralDetail" component={SuperAdminReferralDetailScreen} options={{ ...headerOptions, title: 'Referrer details' }} />
      <Stack.Screen name="SuperAdminCommissionTiers" component={SuperAdminCommissionTiersScreen} options={{ ...headerOptions, title: 'Commission ranges' }} />
      <Stack.Screen name="SuperAdminPaymentTerms" component={SuperAdminPaymentTermsScreen} options={{ ...headerOptions, title: 'Payment terms' }} />
      <Stack.Screen name="SuperAdminFinance" component={SuperAdminFinanceScreen} options={{ ...headerOptions, title: 'School finance' }} />
      <Stack.Screen name="SuperAdminUsers" component={SuperAdminUsersScreen} options={{ ...headerOptions, title: 'All users' }} />
      <Stack.Screen name="SuperAdminUser" component={SuperAdminUserScreen} options={{ ...headerOptions, title: 'User' }} />
      <Stack.Screen name="SuperAdminSchoolView" component={SuperAdminSchoolViewScreen} options={{ ...headerOptions, title: 'School overview' }} />
      <Stack.Screen name="SuperAdminSchool" component={SuperAdminSchoolScreen} options={{ ...headerOptions, title: 'Manage school' }} />
      <Stack.Screen name="SuperAdminVacancy" component={SuperAdminVacancyScreen} options={{ ...headerOptions, title: 'Vacancy settings' }} />
      <Stack.Screen name="QrPoster" component={QrPosterScreen} options={{ ...headerOptions, title: 'Attendance poster' }} />
      <Stack.Screen name="QrCodes" component={QrCodesScreen} options={{ ...headerOptions, title: 'Attendance QR Codes' }} />
      <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} options={{ ...headerOptions, title: 'Staff Attendance' }} />
      <Stack.Screen name="StaffAttendanceDetail" component={StaffAttendanceDetailScreen} options={{ ...headerOptions, title: 'Attendance record' }} />
      <Stack.Screen name="StudentAttendance" component={StudentAttendanceScreen} options={{ ...headerOptions, title: 'Student Attendance' }} />
      <Stack.Screen name="SchoolSettings" component={SchoolSettingsScreen} options={{ ...headerOptions, title: 'School Settings' }} />
      <Stack.Screen name="ClockFriend" component={ClockFriendScreen} options={{ ...headerOptions, title: 'Clock a friend' }} />
      <Stack.Screen name="ResultsStatus" component={ResultsStatusScreen} options={{ ...headerOptions, title: 'Results status' }} />
      <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} options={{ ...headerOptions, title: 'Attendance history' }} />
      <Stack.Screen name="Birthdays" component={BirthdaysScreen} options={{ ...headerOptions, title: 'Birthdays' }} />
      <Stack.Screen name="BirthdayWish" component={BirthdayWishScreen} options={{ ...headerOptions, title: 'Birthday' }} />
      <Stack.Screen name="ParentBirthdayWish" component={ParentBirthdayWishScreen} options={{ ...headerOptions, title: 'Birthday wish' }} />
      <Stack.Screen name="SchoolOverview" component={SchoolOverviewScreen} options={{ ...headerOptions, title: 'School overview' }} />
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ ...headerOptions, title: 'Recent activity' }} />
      <Stack.Screen name="Referral" component={ReferralScreen} options={{ ...headerOptions, title: 'Refer and earn' }} />
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ ...headerOptions, title: 'My profile' }} />
      <Stack.Screen name="MySchools" component={MySchoolsScreen} options={{ ...headerOptions, title: 'My schools' }} />
      <Stack.Screen name="JoinAnotherSchool" component={JoinAnotherSchoolScreen} options={{ ...headerOptions, title: 'Join another school' }} />
      <Stack.Screen name="Roster" component={RosterListScreen} options={{ ...headerOptions, title: 'Roster' }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ ...headerOptions, title: 'Announcements' }} />
      <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} options={{ ...headerOptions, title: 'Announcement' }} />
      <Stack.Screen name="AdminAnnouncements" component={AdminAnnouncementsScreen} options={{ ...headerOptions, title: 'Manage announcements' }} />
      <Stack.Screen name="Vacancies" component={VacanciesScreen} options={{ ...headerOptions, title: 'Job Vacancies' }} />
      <Stack.Screen name="VacancyDetail" component={VacancyDetailScreen} options={{ ...headerOptions, title: 'Vacancy' }} />
      <Stack.Screen name="PostVacancy" component={PostVacancyScreen} options={{ ...headerOptions, title: 'Post a vacancy' }} />
      <Stack.Screen name="MyVacancies" component={MyVacanciesScreen} options={{ ...headerOptions, title: 'My postings' }} />
      <Stack.Screen name="Events" component={EventsScreen} options={{ ...headerOptions, title: 'Events and Fees' }} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ ...headerOptions, title: 'Payment history' }} />
      <Stack.Screen name="EventForm" component={EventFormScreen} options={{ ...headerOptions, title: 'New event' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ ...headerOptions, title: 'Event' }} />
      <Stack.Screen name="ParentFeeDetail" component={ParentFeeDetailScreen} options={{ ...headerOptions, title: 'Fee details' }} />
      <Stack.Screen name="ParentReportCard" component={ReportCardViewScreen} options={{ ...headerOptions, title: 'Report Card' }} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ ...headerOptions, title: 'Receipt' }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ ...headerOptions, title: 'Subscription' }} />
      <Stack.Screen name="PaymentCheckout" component={PaymentCheckoutScreen} options={{ ...headerOptions, title: 'Secure payment', gestureEnabled: false }} />
      <Stack.Screen name="Developer" component={DeveloperScreen} options={{ ...headerOptions, title: 'Developer tools' }} />
      <Stack.Screen name="Logs" component={LogsScreen} options={{ ...headerOptions, title: 'App logs' }} />
      <Stack.Screen name="Scan" component={ScanTestScreen} options={{ ...headerOptions, title: 'QR scan test' }} />
      <Stack.Screen name="Location" component={LocationTestScreen} options={{ ...headerOptions, title: 'Location test' }} />
      <Stack.Screen name="Push" component={PushTestScreen} options={{ ...headerOptions, title: 'Notification check' }} />
      <Stack.Screen name="Pdf" component={PdfTestScreen} options={{ ...headerOptions, title: 'PDF test' }} />
    </Stack.Navigator>
  );
}
