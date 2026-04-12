import * as modules from '../modules'

export const attendanceService = {
  load: modules.loadAttendanceFromLocal,
  save: modules.saveAttendanceToLocal,
  markOne: modules.markStudentAttendance,
  markAll: modules.markAllAttendance,
  summary: modules.getAttendanceSummary,
  monthlyRegister: modules.buildMonthlyRegister,
}

export const admissionService = {
  createRecord: modules.createAdmissionRecord,
  nextAdmissionNo: modules.nextAdmissionNo,
  nextRollNo: modules.nextRollNoForClass,
  findByAdmissionNo: modules.findStudentByAdmissionNo,
  findByRoll: modules.findStudentByRollInClass,
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
  save: modules.saveLibraryToLocal,
  booksForClass: modules.getLibraryBooksForClass,
  addBookToClass: modules.addBookToClass,
  removeBookFromClass: modules.removeBookFromClass,
  searchBooks: modules.searchLibraryBooks,
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
  saveMessages: modules.saveDiscussionMessages,
  createMessage: modules.createDiscussionMessage,
}

export const feeService = {
  load: modules.loadFeeFromLocal,
  save: modules.saveFeeToLocal,
  classStatus: modules.getClassFeeStatus,
  studentStatus: modules.getStudentFeeStatusForClass,
  markStudent: modules.markStudentFeePaid,
  markAll: modules.markAllClassFeePaid,
  remove: modules.removeFeePayment,
  summary: modules.getClassFeeSummary,
  months: modules.getMonthsList,
  formatCurrency: modules.formatCurrency,
}

export const constantsService = {
  whatsappHref: modules.WHATSAPP_HREF,
  telHref: modules.TEL_HREF,
  mailtoHref: modules.MAILTO_HREF,
}
