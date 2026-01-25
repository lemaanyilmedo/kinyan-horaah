/**
 * Google Apps Script for Kinyan Horaah Quiz Data Collection
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1aJs1wUXdaP80yicIiZ2SbupPqr64bVZm4yy028lc_0A/edit
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Click "Deploy" > "New deployment"
 * 5. Choose type: "Web app"
 * 6. Set "Execute as": Me
 * 7. Set "Who has access": Anyone
 * 8. Click "Deploy" and copy the Web App URL
 * 9. Replace the placeholder URL in app.js (line 1465 and 1839) with your actual deployment URL
 * 10. Save and test!
 */

// Main function to handle POST requests
function doPost(e) {
  try {
    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);
    
    // Check if this is a benefit update or a new quiz completion
    if (data.update_type === 'benefit_selection') {
      return updateBenefitSelection(data);
    } else {
      return logQuizCompletion(data);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to log quiz completion data
function logQuizCompletion(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get or create the main data sheet
  let sheet = ss.getSheetByName('Quiz Completions');
  if (!sheet) {
    sheet = ss.insertSheet('Quiz Completions');
    
    // Create headers
    const headers = [
      'Timestamp',
      'Date',
      'Time',
      'Name',
      'Phone',
      'Email',
      'Quiz Type',
      'Score',
      'Total Questions',
      'Correct Answers',
      'Partial Answers',
      'Wrong Answers',
      'Timeout Answers',
      'Attempt Number',
      'Is Repeat User',
      'Publish Name Consent',
      'Marketing Consent',
      'UTM Source',
      'UTM Medium',
      'UTM Campaign',
      'UTM Term',
      'UTM Content',
      'UTM ID',
      'GCLID',
      'FBCLID',
      'Page URL',
      'User Agent',
      'Attempt ID',
      'Selected Benefit',
      'Answers JSON'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  // Prepare row data
  const rowData = [
    data.timestamp || '',
    data.date || '',
    data.time || '',
    data.name || '',
    data.phone || '',
    data.email || '',
    data.quiz_type || '',
    data.score || 0,
    data.total_questions || 0,
    data.correct_answers || 0,
    data.partial_answers || 0,
    data.wrong_answers || 0,
    data.timeout_answers || 0,
    data.attempt_number || 1,
    data.is_repeat_user || 'לא',
    data.publish_name_consent || 'לא',
    data.marketing_consent || 'לא',
    data.utm_source || '',
    data.utm_medium || '',
    data.utm_campaign || '',
    data.utm_term || '',
    data.utm_content || '',
    data.utm_id || '',
    data.gclid || '',
    data.fbclid || '',
    data.page_url || '',
    data.user_agent || '',
    data.attempt_id || '',
    '', // Selected Benefit - will be filled later
    data.answers_json || ''
  ];
  
  // Append the row
  sheet.appendRow(rowData);
  
  // Log to separate sheet by quiz type for easier analysis
  logToQuizTypeSheet(ss, data);
  
  // Update summary statistics
  updateSummaryStats(ss, data);
  
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'Quiz completion logged successfully',
    'row': sheet.getLastRow()
  })).setMimeType(ContentService.MimeType.JSON);
}

// Function to update benefit selection
function updateBenefitSelection(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Quiz Completions');
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': 'Sheet not found'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Find the row with matching phone or attempt_id
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  let rowToUpdate = -1;
  const phoneCol = 5; // Column E (Phone)
  const attemptIdCol = 28; // Column AB (Attempt ID)
  const benefitCol = 29; // Column AC (Selected Benefit)
  
  // Search from bottom to top to find the most recent entry
  for (let i = values.length - 1; i > 0; i--) {
    if ((data.phone && values[i][phoneCol - 1] === data.phone) ||
        (data.attempt_id && values[i][attemptIdCol - 1] === data.attempt_id)) {
      rowToUpdate = i + 1;
      break;
    }
  }
  
  if (rowToUpdate > 0) {
    sheet.getRange(rowToUpdate, benefitCol).setValue(data.selected_benefit || '');
    
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'message': 'Benefit selection updated',
      'row': rowToUpdate
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'warning',
      'message': 'No matching record found to update'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to log data to quiz-type-specific sheet
function logToQuizTypeSheet(ss, data) {
  const sheetName = data.quiz_type || 'Unknown';
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Create headers
    const headers = [
      'Timestamp',
      'Name',
      'Phone',
      'Email',
      'Score',
      'Attempt Number',
      'Marketing Consent',
      'UTM Source',
      'UTM Campaign',
      'Selected Benefit'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  const rowData = [
    data.timestamp || '',
    data.name || '',
    data.phone || '',
    data.email || '',
    data.score || 0,
    data.attempt_number || 1,
    data.marketing_consent || 'לא',
    data.utm_source || '',
    data.utm_campaign || '',
    '' // Selected Benefit - will be filled later
  ];
  
  sheet.appendRow(rowData);
}

// Function to update summary statistics
function updateSummaryStats(ss, data) {
  let sheet = ss.getSheetByName('Summary Stats');
  
  if (!sheet) {
    sheet = ss.insertSheet('Summary Stats');
    
    // Create initial structure
    const headers = [
      'Metric',
      'הלכות שבת',
      'איסור והיתר',
      'Total'
    ];
    
    const metrics = [
      'Total Completions',
      'Average Score',
      'Total with Marketing Consent',
      'Total Repeat Users',
      'High Scorers (80%+)',
      'Last Updated'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    
    for (let i = 0; i < metrics.length; i++) {
      sheet.getRange(i + 2, 1).setValue(metrics[i]);
    }
    
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
  }
  
  // Update the last updated timestamp
  const lastUpdatedRow = 7; // Row for "Last Updated"
  sheet.getRange(lastUpdatedRow, 2, 1, 3).setValues([[
    new Date().toLocaleString('he-IL'),
    new Date().toLocaleString('he-IL'),
    new Date().toLocaleString('he-IL')
  ]]);
  
  // Calculate and update statistics
  const mainSheet = ss.getSheetByName('Quiz Completions');
  if (mainSheet) {
    const dataRange = mainSheet.getDataRange();
    const values = dataRange.getValues();
    
    // Count statistics
    let shabbatCount = 0, issurCount = 0;
    let shabbatScoreSum = 0, issurScoreSum = 0;
    let shabbatConsent = 0, issurConsent = 0;
    let shabbatRepeat = 0, issurRepeat = 0;
    let shabbatHigh = 0, issurHigh = 0;
    
    for (let i = 1; i < values.length; i++) {
      const quizType = values[i][6]; // Quiz Type column
      const score = values[i][7]; // Score column
      const marketingConsent = values[i][16]; // Marketing Consent column
      const isRepeat = values[i][14]; // Is Repeat User column
      
      if (quizType === 'הלכות שבת') {
        shabbatCount++;
        shabbatScoreSum += score;
        if (marketingConsent === 'כן') shabbatConsent++;
        if (isRepeat === 'כן') shabbatRepeat++;
        if (score >= 80) shabbatHigh++;
      } else if (quizType === 'איסור והיתר') {
        issurCount++;
        issurScoreSum += score;
        if (marketingConsent === 'כן') issurConsent++;
        if (isRepeat === 'כן') issurRepeat++;
        if (score >= 80) issurHigh++;
      }
    }
    
    // Update statistics
    sheet.getRange(2, 2).setValue(shabbatCount); // Shabbat completions
    sheet.getRange(2, 3).setValue(issurCount); // Issur completions
    sheet.getRange(2, 4).setValue(shabbatCount + issurCount); // Total
    
    sheet.getRange(3, 2).setValue(shabbatCount > 0 ? Math.round(shabbatScoreSum / shabbatCount) : 0); // Shabbat avg
    sheet.getRange(3, 3).setValue(issurCount > 0 ? Math.round(issurScoreSum / issurCount) : 0); // Issur avg
    sheet.getRange(3, 4).setValue((shabbatCount + issurCount) > 0 ? Math.round((shabbatScoreSum + issurScoreSum) / (shabbatCount + issurCount)) : 0); // Total avg
    
    sheet.getRange(4, 2).setValue(shabbatConsent);
    sheet.getRange(4, 3).setValue(issurConsent);
    sheet.getRange(4, 4).setValue(shabbatConsent + issurConsent);
    
    sheet.getRange(5, 2).setValue(shabbatRepeat);
    sheet.getRange(5, 3).setValue(issurRepeat);
    sheet.getRange(5, 4).setValue(shabbatRepeat + issurRepeat);
    
    sheet.getRange(6, 2).setValue(shabbatHigh);
    sheet.getRange(6, 3).setValue(issurHigh);
    sheet.getRange(6, 4).setValue(shabbatHigh + issurHigh);
  }
}

// Function to handle GET requests (for testing)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'Kinyan Horaah Quiz Data Collection API is running',
    'timestamp': new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
