import * as modules from '../modules'

export const attendanceService = {
  load: modules.loadAttendanceFromLocal,
  hydrate: modules.hydrateAttendanceFromCloud,
  save: modules.saveAttendanceToLocal,
  markOne: modules.markStudentAttendance,
  markAll: modules.markAllAttendance,
  summary: modules.getAttendanceSummary,
  monthlyRegister: modules.buildMonthlyRegister,
  todaySnapshot: modules.summarizeTodayAttendanceLeave,
  studentLeaveAdd: modules.addStudentLeaveRecord,
  studentLeaveUpdate: modules.updateStudentLeaveStatus,
  absenteeList: modules.buildAbsenteeList,
  monthlyRates: modules.computeMonthlyStudentRates,
}

export const admissionService = {
  createRecord: modules.createAdmissionRecord,
  nextAdmissionNo: modules.nextAdmissionNo,
  nextRollNo: modules.nextRollNoForClass,
  findByAdmissionNo: modules.findStudentByAdmissionNo,
  findByRoll: modules.findStudentByRollInClass,
}

export const studentsService = {
  search: modules.searchStudents,
  filterByStatus: modules.filterStudentsByStatus,
  summarize: modules.summarizeStudentDirectory,
  getStatus: modules.getStudentStatus,
  addHealthNote: modules.addHealthNote,
  addDiscipline: modules.addDisciplineRecord,
  addDocument: modules.addStudentDocument,
  setLeaving: modules.setLeavingInfo,
  setLifecycleStatus: modules.setStudentLifecycleStatus,
  nextGradeOptions: modules.getNextGradeClassOptions,
}

export const staffService = {
  search: modules.searchStaffProfiles,
  summarize: modules.summarizeStaffDirectory,
  loadAttendance: modules.loadStaffAttendanceFromLocal,
  saveAttendance: modules.saveStaffAttendanceToLocal,
  markAttendance: modules.markStaffAttendance,
  markAllAttendance: modules.markAllStaffAttendance,
  attendanceSummary: modules.summarizeStaffAttendanceDay,
  addLeave: modules.addStaffLeaveRecord,
  updateLeaveStatus: modules.updateStaffLeaveStatus,
  addDocument: modules.addStaffDocument,
  assignments: modules.buildStaffAssignments,
  restoreRetired: modules.restoreRetiredStaff,
}

export const academicService = {
  summarize: modules.summarizeAcademicStructure,
  subjectMatrix: modules.buildClassSubjectMatrix,
  addClass: modules.addAcademicClass,
  removeClass: modules.removeAcademicClass,
  addSubject: modules.addClassSubject,
  removeSubject: modules.removeClassSubject,
  validateSession: modules.validateSessionLabel,
  addCalendarEvent: modules.addCalendarEvent,
  upcomingEvents: modules.upcomingCalendarEvents,
  addSchemeUnit: modules.addSchemeUnit,
}

export const examinationService = {
  setTotalMarks: modules.setTotalMarks,
  setObtainedMarks: modules.setObtainedMarks,
  totals: modules.calculateExamTotals,
  subjectStat: modules.subjectStat,
  overallStat: modules.overallStat,
  grade: modules.gradeFromPercentage,
}

export const timetableService = {
  calcTimes: modules.calcTimes,
  getCell: modules.getTimetableCell,
  setCellAllDays: modules.setTimetableCellAllDays,
  parseABVariant: modules.parseABVariantSubject,
  isABCounterpart: modules.isABCounterpartSubject,
  subjectUsedInDay: modules.subjectUsedInDay,
}

export const cardGeneratorService = {
  parseRollTokens: modules.parseRollTokensToSet,
  parseAdmissionTokens: modules.parseAdmissionTokens,
  selectStudents: modules.selectStudentsForCards,
  filterStaff: modules.filterStaffProfilesByQuery,
  buildStudentPdfName: modules.buildStudentCardsPdfName,
}

export const paperGeneratorService = {
  getCurrentBank: modules.getQuestionBankForCurrent,
  setCurrentBank: modules.setQuestionBankForCurrent,
  filterBank: modules.filterQuestionBank,
  generateFromBank: modules.generatePaperFromBank,
  totalMarks: modules.getPaperTotalMarks,
}

export const bookBankService = {
  normalize: modules.normalize,
  thumbnailCandidates: modules.getThumbnailCandidates,
  currentClass: modules.getCurrentClass,
  visibleBooks: modules.getVisibleBooks,
  renderedBooks: modules.getRenderedBooks,
}

export const libraryService = {
  load: modules.loadLibraryFromLocal,
  hydrate: modules.hydrateLibraryFromCloud,
  save: modules.saveLibraryToLocal,
  booksForClass: modules.getLibraryBooksForClass,
  addBookToClass: modules.addBookToClass,
  removeBookFromClass: modules.removeBookFromClass,
  searchBooks: modules.searchLibraryBooks,
  summarize: modules.summarizeLibrary,
  overdue: modules.listOverdue,
  members: modules.listMembers,
  rules: modules.loadLibraryRules,
  saveRules: modules.saveLibraryRules,
  circulation: modules.buildCirculationReport,
  finePayments: modules.loadFinePayments,
}

export const authService = {
  loadUsers: modules.loadAuthUsers,
  saveUsers: modules.saveAuthUsers,
  loadSession: modules.loadAuthSession,
  saveSession: modules.saveAuthSession,
  findUserByEmail: modules.findUserByEmail,
  userSignIn: modules.tryUserSignIn,
  adminSignIn: modules.tryAdminSignIn,
}

export const dashboardService = {
  staffCounts: modules.computeStaffCounts,
  subjectStat: modules.subjectStatDash,
  overallStat: modules.overallStatDash,
  classStats: modules.buildClassStats,
  feeStats: modules.computeFeeStats,
  todayAttendance: modules.computeTodayAttendance,
  upcomingExams: modules.buildUpcomingExams,
  reminders: modules.buildDashboardReminders,
  search: modules.searchSchoolRecords,
  countSections: modules.countSections,
}

export const systemSettingsService = {
  academicSession: modules.academicSession,
  defaultSession: modules.defaultSession,
  addSession: modules.addSessionToList,
  loadLocal: modules.loadSystemDataFromLocal,
  saveLocal: modules.saveSystemDataToLocal,
  resolveClass: modules.resolveClass,
  formatClassDisplay: modules.formatClassDisplay,
  formatGradeLabel: modules.formatGradeLabel,
  getClassLabel: modules.getClassLabel,
  normKey: modules.normKey,
}

export const aboutSupportService = {
  formatChatTime: modules.formatChatTime,
  loadMessages: modules.loadDiscussionMessages,
  hydrateMessages: modules.hydrateDiscussionFromCloud,
  saveMessages: modules.saveDiscussionMessages,
  createMessage: modules.createDiscussionMessage,
}

export const feeService = {
  load: modules.loadFeeFromLocal,
  hydrate: modules.hydrateFeesFromCloud,
  save: modules.saveFeeToLocal,
  classStatus: modules.getClassFeeStatus,
  studentStatus: modules.getStudentFeeStatusForClass,
  markStudent: modules.markStudentFeePaid,
  markAll: modules.markAllClassFeePaid,
  remove: modules.removeFeePayment,
  summary: modules.getClassFeeSummary,
  months: modules.getMonthsList,
  formatCurrency: modules.formatCurrency,
  effectiveAmount: modules.getEffectiveFeeAmount,
  financeSummary: modules.summarizeFeeFinance,
  dues: modules.buildDuesList,
  receipts: modules.buildReceiptsList,
  yearlyTrend: modules.buildYearlyFeeTrend,
  loadConcessions: modules.loadConcessions,
  saveConcessions: modules.saveConcessions,
  loadExpenses: modules.loadExpenses,
  saveExpenses: modules.saveExpenses,
}

export const constantsService = {
  whatsappHref: modules.WHATSAPP_HREF,
  telHref: modules.TEL_HREF,
  mailtoHref: modules.MAILTO_HREF,
}
