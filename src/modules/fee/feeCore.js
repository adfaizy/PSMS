// Fee collection management - 20 Rs per student per month
import { resolveClass } from '../systemSettings/systemSettingsCore';

export const FEE_DATA_KEY = 'system_management_fee'
export const FEE_AMOUNT = 20;

function getStorage(storageOverride) {
  if (storageOverride) return storageOverride
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function loadFeeFromLocal(schoolId, storageOverride) {
  try {
    if (!schoolId) return []
    const storage = getStorage(storageOverride)
    if (!storage) return []
    const raw = storage.getItem(FEE_DATA_KEY)
    if (!raw) return []
    const allSchools = JSON.parse(raw)
    const schoolFees = allSchools?.[schoolId] || []
    return Array.isArray(schoolFees) ? schoolFees : []
  } catch {
    return []
  }
}

export function saveFeeToLocal(schoolId, feeRecords, storageOverride) {
  try {
    if (!schoolId) return
    const storage = getStorage(storageOverride)
    if (!storage) return
    const raw = storage.getItem(FEE_DATA_KEY)
    const allSchools = raw ? JSON.parse(raw) : {}
    allSchools[schoolId] = Array.isArray(feeRecords) ? feeRecords : []
    storage.setItem(FEE_DATA_KEY, JSON.stringify(allSchools))
  } catch {
    // silent fail to keep app resilient in restricted storage contexts
  }
}

export function getFeeKey(classId, studentId, month, year) {
  return `${classId}_${studentId}_${month}_${year}`;
}

export function getClassFeeKey(classId, month, year) {
  return `class_${classId}_${month}_${year}`;
}

export function getMonthlyFeeRecords(feeRecords, month, year) {
  if (!Array.isArray(feeRecords)) return [];
  return feeRecords.filter(rec => rec.month === month && rec.year === year);
}

export function getClassFeeSummary(feeRecords, classes, month, year, students = []) {
  const summary = [];

  classes.forEach(cls => {
    const classStudents = students.filter(s => {
      const studentClass = resolveClass(classes, s.classId);
      return studentClass && String(studentClass.id) === String(cls.id);
    });
    const expectedAmount = classStudents.length * FEE_AMOUNT;

    const classRecords = feeRecords.filter(
      rec => {
        const recordClass = resolveClass(classes, rec.classId);
        return recordClass && String(recordClass.id) === String(cls.id) && rec.month === month && rec.year === year;
      }
    );

    const collectedAmount = classRecords.reduce((sum, rec) => sum + (rec.amount || 0), 0);
    const paidCount = classRecords.length;
    const pendingCount = classStudents.length - paidCount;

    summary.push({
      classId: cls.id,
      className: cls.label || cls.name || `Class ${cls.id}`,
      totalStudents: classStudents.length,
      paidCount,
      pendingCount,
      expectedAmount,
      collectedAmount,
      pendingAmount: expectedAmount - collectedAmount
    });
  });

  return summary;
}

export function getClassFeeStatus(feeRecords, { classId, month, year, students, classes }) {
  const classStudents = students.filter(s => {
    const studentClass = resolveClass(classes, s.classId);
    return studentClass && String(studentClass.id) === String(classId);
  })
  const total = classStudents.length
  
  const paidStudents = classStudents.filter(student => {
    const record = feeRecords.find(
      rec => String(rec.studentId) === String(student.id) && 
             String(rec.classId) === String(classId) && 
             rec.month === month && 
             rec.year === year
    )
    return !!record
  })
  
  const paid = paidStudents.length
  const pending = total - paid
  const expectedAmount = total * FEE_AMOUNT
  const collectedAmount = paid * FEE_AMOUNT
  
  return {
    total,
    paid,
    pending,
    expectedAmount,
    collectedAmount,
    pendingAmount: expectedAmount - collectedAmount,
    collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
    paidStudentIds: paidStudents.map(s => s.id),
    pendingStudentIds: classStudents.filter(s => !paidStudents.find(ps => ps.id === s.id)).map(s => s.id)
  }
}

export function getStudentFeeStatusForClass(feeRecords, { classId, studentId, month, year }) {
  const record = feeRecords.find(
    rec => String(rec.studentId) === String(studentId) && 
           String(rec.classId) === String(classId) && 
           rec.month === month && 
           rec.year === year
  )
  
  return {
    paid: !!record,
    record,
    status: record ? 'paid' : 'pending',
    amount: record?.amount || FEE_AMOUNT
  }
}

export function markStudentFeePaid(feeRecords, { studentId, classId, month, year, amount = FEE_AMOUNT }) {
  const existingIndex = feeRecords.findIndex(
    rec => String(rec.studentId) === String(studentId) && 
           String(rec.classId) === String(classId) && 
           rec.month === month && 
           rec.year === year
  )

  const newRecord = {
    id: `fee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    studentId: String(studentId),
    classId: String(classId),
    month,
    year,
    amount,
    paidAt: new Date().toISOString()
  }

  if (existingIndex >= 0) {
    const updated = [...feeRecords]
    updated[existingIndex] = newRecord
    return updated
  } else {
    return [...feeRecords, newRecord]
  }
}

export function markAllClassFeePaid(feeRecords, { classId, month, year, students, classes }) {
  const classStudents = students.filter(s => {
    const studentClass = resolveClass(classes, s.classId);
    return studentClass && String(studentClass.id) === String(classId);
  })
  const newRecords = classStudents.map(student => {
    const existingIndex = feeRecords.findIndex(
      rec => String(rec.studentId) === String(student.id) && 
             String(rec.classId) === String(classId) && 
             rec.month === month && 
             rec.year === year
    )

    if (existingIndex >= 0) return feeRecords[existingIndex]

    return {
      id: `fee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${student.id}`,
      studentId: String(student.id),
      classId: String(classId),
      month,
      year,
      amount: FEE_AMOUNT,
      paidAt: new Date().toISOString()
    }
  })

  const filteredRecords = feeRecords.filter(
    rec => !(String(rec.classId) === String(classId) && rec.month === month && rec.year === year)
  )

  return [...filteredRecords, ...newRecords]
}

export function recordFeePayment(feeRecords, studentId, classId, month, year, amount = FEE_AMOUNT) {
  const key = getFeeKey(classId, studentId, month, year);
  const existingIndex = feeRecords.findIndex(
    rec => getFeeKey(String(rec.classId), String(rec.studentId), rec.month, rec.year) === key
  );

  const newRecord = {
    id: `fee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    studentId: String(studentId),
    classId: String(classId),
    month,
    year,
    amount,
    paidAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    // Update existing record
    const updated = [...feeRecords];
    updated[existingIndex] = newRecord;
    return updated;
  } else {
    // Add new record
    return [...feeRecords, newRecord];
  }
}

export function removeFeePayment(feeRecords, studentId, classId, month, year) {
  return feeRecords.filter(
    rec => !(String(rec.studentId) === String(studentId) && String(rec.classId) === String(classId) && rec.month === month && rec.year === year)
  )
}

export function getMonthsList() {
  return [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];
}

export function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-PK')}`;
}
