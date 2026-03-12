const fs = require("fs");

// Helper functions
function parseTime12Hour(timeStr) {
    const parts = timeStr.trim().toLowerCase().split(' ');
    const time = parts[0];
    const period = parts[1];
    
    const [hours, minutes, seconds] = time.split(':').map(Number);
    
    let totalHours = hours;
    if (period === 'am') {
        if (hours === 12) totalHours = 0;
    } else {
        if (hours !== 12) totalHours += 12;
    }
    
    return totalHours * 3600 + minutes * 60 + seconds;
}

function parseDuration(durationStr) {
    const [hours, minutes, seconds] = durationStr.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const remainingSeconds = seconds % 3600;
    const minutes = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function isSpecialPeriod(date) {
    const [year, month, day] = date.split('-').map(Number);
    if (year === 2025 && month === 4) {
        return day >= 10 && day <= 30;
    }
    return false;
}

function readFileLines(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        return [];
    }
}

function parseCSVLine(line) {
    return line.split(',').map(item => item.trim());
}

function normalizeMonth(month) {
    return month.toString().padStart(2, '0');
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    const startSeconds = parseTime12Hour(startTime);
    const endSeconds = parseTime12Hour(endTime);
    
    let duration;
    if (endSeconds >= startSeconds) {
        duration = endSeconds - startSeconds;
    } else {
        duration = (24 * 3600 - startSeconds) + endSeconds;
    }
    
    return formatDuration(duration);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    const startSeconds = parseTime12Hour(startTime);
    const endSeconds = parseTime12Hour(endTime);
    
    const deliveryStart = 8 * 3600;
    const deliveryEnd = 22 * 3600;
    
    let idleSeconds = 0;
    
    if (endSeconds >= startSeconds) {
        if (startSeconds < deliveryStart) {
            idleSeconds += Math.min(deliveryStart - startSeconds, endSeconds - startSeconds);
        }
        if (endSeconds > deliveryEnd) {
            idleSeconds += Math.min(endSeconds - deliveryEnd, endSeconds - startSeconds);
        }
    } else {
        if (startSeconds < deliveryStart) {
            idleSeconds += Math.min(deliveryStart - startSeconds, 24 * 3600 - startSeconds);
        }
        if (endSeconds > deliveryEnd) {
            idleSeconds += Math.min(endSeconds - deliveryEnd, endSeconds);
        }
        if (startSeconds >= deliveryEnd) {
            idleSeconds += (24 * 3600 - startSeconds) + endSeconds;
        }
    }
    
    return formatDuration(idleSeconds);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    const shiftSeconds = parseDuration(shiftDuration);
    const idleSeconds = parseDuration(idleTime);
    
    const activeSeconds = Math.max(0, shiftSeconds - idleSeconds);
    
    return formatDuration(activeSeconds);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    const activeSeconds = parseDuration(activeTime);
    
    const quotaSeconds = isSpecialPeriod(date) ? 6 * 3600 : (8 * 3600 + 24 * 60);
    
    return activeSeconds >= quotaSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    const lines = readFileLines(textFile);
    
    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length >= 3 && parts[0] === shiftObj.driverID && parts[2] === shiftObj.date) {
            return {};
        }
    }
    
    const shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const metQuotaResult = metQuota(shiftObj.date, activeTime);
    
    const newRecord = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: metQuotaResult,
        hasBonus: false
    };
    
    const newLine = `${newRecord.driverID},${newRecord.driverName},${newRecord.date},${newRecord.startTime},${newRecord.endTime},${newRecord.shiftDuration},${newRecord.idleTime},${newRecord.activeTime},${newRecord.metQuota},${newRecord.hasBonus}`;
    
    lines.push(newLine);
    fs.writeFileSync(textFile, lines.join('\n'));
    
    return newRecord;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    const lines = readFileLines(textFile);
    let found = false;
    
    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length >= 10 && parts[0] === driverID && parts[2] === date) {
            parts[9] = newValue.toString();
            lines[i] = parts.join(',');
            found = true;
            break;
        }
    }
    
    if (found) {
        fs.writeFileSync(textFile, lines.join('\n'));
    }
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    const lines = readFileLines(textFile);
    const normalizedMonth = normalizeMonth(month);
    let driverExists = false;
    let bonusCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length >= 3) {
            if (parts[0] === driverID) {
                driverExists = true;
                const recordMonth = parts[2].substring(5, 7);
                if (recordMonth === normalizedMonth && parts[9] === 'true') {
                    bonusCount++;
                }
            }
        }
    }
    
    return driverExists ? bonusCount : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
