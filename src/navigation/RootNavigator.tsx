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
import ClassDetailScreen from '../screens/ClassDetailScreen';
import ClassFormScreen from '../screens/ClassFormScreen';

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
      <Stack.Screen name="ClassDetail" component={ClassDetailScreen} options={{ ...headerOptions, title: 'Class' }} />
      <Stack.Screen name="ClassForm" component={ClassFormScreen} options={{ ...headerOptions, title: 'Add class' }} />
      <Stack.Screen name="Developer" component={DeveloperScreen} options={{ ...headerOptions, title: 'Developer tools' }} />
      <Stack.Screen name="Logs" component={LogsScreen} options={{ ...headerOptions, title: 'App logs' }} />
      <Stack.Screen name="Scan" component={ScanTestScreen} options={{ ...headerOptions, title: 'QR scan test' }} />
      <Stack.Screen name="Location" component={LocationTestScreen} options={{ ...headerOptions, title: 'Location test' }} />
      <Stack.Screen name="Push" component={PushTestScreen} options={{ ...headerOptions, title: 'Push test' }} />
      <Stack.Screen name="Pdf" component={PdfTestScreen} options={{ ...headerOptions, title: 'PDF test' }} />
    </Stack.Navigator>
  );
}
