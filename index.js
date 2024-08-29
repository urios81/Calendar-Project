(function() {
    
    const eventHandlers = [];           // Store event handlers so they can be un-wired later.
    let unmounting = false;             // Used to cancel the checkElement search if the template is being removed from the DOM.
    
    const formId = 1;
    let calendarData;
    
    /** Checks if the top-level element exists in the DOM. The DOM will be checked every 100ms.
     *   
     *  resolve -- This function is called once the top-level element is located.
     */
    function checkElement(elementId, resolve) {
        const element = document.getElementById(elementId);
        if (element) {
            resolve($(element));
        }
        else if (!unmounting) {
            setTimeout(() => checkElement("Calendar", resolve), 100);
        }
    }
    
    /** Wrapper function to wait for the top-level element to exist in the DOM. */
    function waitForTopLevelElement() {
        return new Promise(resolve => checkElement("Calendar", resolve));
    }
    
    /** Should be used to add an event handler so that same handler can be un-wired later. */
    function addEventHandler(element, event, handler) {
        $(element).on(event, handler);
        eventHandlers.push({ element, event, handler });
    }
    
    /** Uses a `MutationObserver` to watch for this same script to be removed from the DOM. Once it's removed,
     *  the event handlers which were created are then un-wired.
     */
    function configureCleanup() {
        const observer = new MutationObserver(mutations => {
            const wasScriptRemoved = mutations
                .filter(o => o.type === "childList")
                .flatMap(o => Array.from(o.removedNodes))
                .some(o => o.nodeName === "SCRIPT" && o.getAttribute("id") === "Calendar_script");
            
            if (wasScriptRemoved) {
                eventHandlers.forEach(({ element, event, handler }) => {
                    $(element).off(event, handler);
                });
                
                observer.disconnect();
                unmounting = true;
            }
        });
        
        observer.observe(document.body, { childList: true });
    }
    
    // Function that delays the search bar search until 0.5s after the final key has been clicked (prevents filter from activating on each keyboard click)
    function vanillaDebounce(callback, wait) {
        let timeoutId = null;
        
        return (...args) => {
            window.clearTimeout(timeoutId);
            
            timeoutId = window.setTimeout(() => {
                callback.apply(null, args);
            }, wait);
        };
    }
    
    
    // ------------------- Start of Non-Boiler Plate JS -------------------
    
    // Function to view the submission window after the button has been clicked
    function viewSubmissionModal() {
        const btnSubmissionId = Number($(this)[0].id.split("_")[1]);
        
        let button = $(this)[0];
        
        const modalId = $(this)[0].closest('.modal').id;
        const modalContainer = $("#Calendar").find("#"+modalId);
        modalContainer.modal('toggle');
        
        function waitForBtn() {
            button = $(this)[0];
            // If the button is rendered, open the modal with the submission data
            if(button != null) {
                console.log('');
                var event = new CustomEvent('view_' + formId, { detail: { formId: formId, submissionId: btnSubmissionId } });
                window.dispatchEvent(event);
                
            } 
            else {
                window.setTimeout(waitForBtn, 100);
            }
        };
        
        setTimeout(waitForBtn, 500);
        
    }
    
    // Function to find the buttons to open submission window
    function findSubmissionBtns() {
        const submissionBtns = $("#Calendar").find(".submission-calendar-modal-btn");
        
        addEventHandler(submissionBtns, "click", viewSubmissionModal);
    }
    
    // Function to take each event & create a recurring event on the date if parameters are met
    function createRecurringEvent(eventEntry, calendarDate) {
        
        // When needing to compare start date, without time of event, use this variable
        let startDateCompare = new Date(eventEntry.startDateTime);
        startDateCompare = new Date(startDateCompare).setHours(0, 0, 0, 0);
        startDateCompare = new Date(startDateCompare);
        
        // The new start date of the recurring event (take the original start date & add the difference between calendar date & the start date)
        let newStartDate = new Date(eventEntry.startDateTime);
        newStartDate = new Date(newStartDate.getTime() + (new Date(new Date(calendarDate).setHours(0, 0, 0, 0)).getTime() - startDateCompare) );
        // The new end date of the recurring event (take the original start date & add the difference between the original end date & original start date)
        let newEndDate = new Date(eventEntry.endDateTime);
        newEndDate = new Date(newStartDate.getTime() + (newEndDate.getTime() - new Date(eventEntry.startDateTime).getTime()) );
            
        // Variables for non-required entry data (make sure data exists before assigning it to variable in new object)
        let eventType = eventEntry.eventType;
        let addInfo = eventEntry.additionalInformation;
        let timeFrame = eventEntry.timeFrame;
        let endRecur = eventEntry.endRecurring;

        // Varaible to retrun, could possibly hold data on recurring event
        let recurEntry = "";
        
        // Event occurs everyday
        if (timeFrame === "DailyEveryday") {
            recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
            
        // Event occurs everyday except the weekends (Sunday = day of week 0, Saturday = day of week 6)
        } else if (timeFrame === "DailyWeekday" && (calendarDate.getDay() !== 0 && calendarDate.getDay() !== 6)) {
            recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
            
        } else if (timeFrame === "Weekly") {
            // Event occurs every week on same day of week (making sure they are 7 days apart)
            if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.round((calendarDate.getTime() - startDateCompare.getTime())/86400000) % 7 === 0) ) {
                recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
            }
            
        } else if (timeFrame === "BiWeekly") {
            // Event occurs every other week on same day of week (making sure they are 14 days apart)
            if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.round((calendarDate.getTime() - startDateCompare.getTime())/86400000) % 14 === 0) )  {
                recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
            }
        
        } else if (timeFrame === "Monthly") {
            // Event occurs every month on same day of the week & on same number of day of the week in that month (2nd tuesday of every month)
            // Math takes the date & rounds it down to the floor to get if its the 1st, 2nd, etc Tuesday of that month
            if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.floor(calendarDate.getDate()/7) === Math.floor(startDateCompare.getDate()/7)) ) {
                recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
            }
            
        } else if (timeFrame === "BiMonthly") {
            // If the month index (Jan = 0, Feb = 1, etc.) of the start month is larger
            if (startDateCompare.getMonth() > calendarDate.getMonth()) {
                // Event occurs every other month on same day of the week & on same number of day of the week in that month (2nd tuesday of every other month)
                // Math takes the date & rounds it down to the floor to get if its the 1st, 2nd, etc Tuesday of that month
                if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.floor(calendarDate.getDate()/7) === Math.floor(startDateCompare.getDate()/7)) && ((startDateCompare.getMonth() - calendarDate.getMonth()) % 2 === 0) ) {
                    recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
                }
            } else {
                if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.floor(calendarDate.getDate()/7) === Math.floor(startDateCompare.getDate()/7)) && ((calendarDate.getMonth() - startDateCompare.getMonth()) % 2 === 0) ) {
                    recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
                }
            }
            
        } else if (timeFrame === "Quarterly") {
            // If the month index (Jan = 0, Feb = 1, etc.) of the start month is larger
            if (startDateCompare.getMonth() > calendarDate.getMonth()) {
                // Event occurs every 3rd month on same day of the week & on same number of day of the week in that month (2nd tuesday of every 3rd month)
                // Math takes the date & rounds it down to the floor to get if its the 1st, 2nd, etc Tuesday of that month
                if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.floor(calendarDate.getDate()/7) === Math.floor(startDateCompare.getDate()/7)) && ((startDateCompare.getMonth() - calendarDate.getMonth()) % 3 === 0) ) {
                    recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
                }
            } else {
                if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.floor(calendarDate.getDate()/7) === Math.floor(startDateCompare.getDate()/7)) && ((calendarDate.getMonth() - startDateCompare.getMonth()) % 3 === 0) ) {
                    recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};    
                }
            }
            
        } else if (timeFrame === "SemiAnnually") {
            // If the month index (Jan = 0, Feb = 1, etc.) of the start month is larger
            if (startDateCompare.getMonth() > calendarDate.getMonth()) {
                // Event occurs every 6th month on same day of the week & on same number of day of the week in that month (2nd tuesday of every 6th month)
                // Math takes the date & rounds it down to the floor to get if its the 1st, 2nd, etc Tuesday of that month
                if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.floor(calendarDate.getDate()/7) === Math.floor(startDateCompare.getDate()/7)) && ((startDateCompare.getMonth() - calendarDate.getMonth()) % 6 === 0) ) {
                    recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
                }
            } else {
                if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.floor(calendarDate.getDate()/7) === Math.floor(startDateCompare.getDate()/7)) && ((calendarDate.getMonth() - startDateCompare.getMonth()) % 6 === 0) ) {
                    recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};    
                }
            }
            
        } else if (timeFrame === "Annually") {
            // Event occurs every 6th month on same day of the week & on same number of day of the week in that month (2nd tuesday of every 6th month) & ff the month index (Jan = 0, Feb = 1, etc.)are the same
            // Math takes the date & rounds it down to the floor to get if its the 1st, 2nd, etc Tuesday of that month
            if ((startDateCompare.getDay() === calendarDate.getDay()) && (Math.floor(calendarDate.getDate()/7) === Math.floor(startDateCompare.getDate()/7)) && (startDateCompare.getMonth() === calendarDate.getMonth()) ) {
                recurEntry = {answers: [{"questionKey": "eventName", "value": eventEntry.eventName}, {"questionKey": "startDateTime", "value": newStartDate}, {"questionKey": "endDateTime", "value": newEndDate}, {"questionKey": "eventType", "value": {"selections": [eventType]} }, {"questionKey": "additionalInformation", "value": addInfo}, {"questionKey": "timeFrame", "value": {"selections": [timeFrame]} }, {"questionKey": "endRecurring", "value": endRecur}], submissionId: eventEntry.submissionId};
            }
        }
        
        return recurEntry
    }
    
    // Add created recurring events to list & add to main filtered data if it meets parameters
    function createRecurringEvents(filteredData) {
        // List to hold all recurring events created
        let recurringEvents = [];
        
        // Grab the current month to help create events
        let recurDate = new Date();
        recurDate = new Date(recurDate.getFullYear(), recurDate.getMonth(), 1);
        const monthEl = $("#Calendar_MonthDisplay");
        const monthVal = Number(monthEl.attr("navVal"));
        if (monthVal != 0) {
            recurDate.setMonth(new Date().getMonth() + monthVal);
        }
        
        // Get current calendar display month
        const recurDate_Month = recurDate.getMonth();
        // Get current calendar display year
        const recurDate_Year = recurDate.getFullYear();
        // Tracking day of month as code loops through every day
        let dayOfRecurMonth = new Date(recurDate_Year, recurDate_Month, 1);
        // Number of days of the current calendar display month
        const numMonthDays = new Date(recurDate_Year, recurDate_Month + 1, 0).getDate();
        
        // For every day in the month
        for (let i = 1; i <= numMonthDays; i++) {
            // Created array of data whose events have already passed the end date, are recurring, & is before or on the stop recurring date (if there is one)
            filteredData.map(function(submission) {
                const keyList = Object.keys(submission);
                
                // If there is a time frame value (indicates recurring events)
                if (keyList.includes("timeFrame")) {
                    // If the recurring question is not blank
                    if (submission.timeFrame != "") {
                        // Calculate end of the end date/time of the event
                        const endVal = submission.endDateTime;
                        const endDate = new Date(endVal).setHours(23, 59, 59, 999);
                        
                        // If there is a date that recurring the event stops
                        if (submission.endRecurring && (submission.endRecurring != "")) {
                            // Calculate the end of recurring date to end of the day
                            const endRecurVal = submission.endRecurring;
                            const endRecurDate = new Date(endRecurVal).setHours(23, 59, 59, 999) + 86400000;
                            
                            // If the day date is after the event end date & is before or on the end recurring date
                            if ((dayOfRecurMonth.getTime() > endDate) && (dayOfRecurMonth.getTime() <= endRecurDate)) {
                                // Take the submission event & create a recurring event if its on this date
                                const eventRecurObj = createRecurringEvent(submission, dayOfRecurMonth);
                                // If there is a recurring event
                                if (eventRecurObj !== "") {
                                    // Grab the start date of the recurring event
                                    const eventRecurStartDate = new Date(eventRecurObj.startDateTime).getTime();
                                    // Filter the submission data for entries that have the same submission ID & the recurring event start date is before the submission end date
                                    const submisFilteredData = filteredData.filter(subEntry => {
                                        let subEndDate = new Date(subEntry.endDateTime).setHours(23, 59, 59, 999);
                                        if ((subEntry.submissionId === eventRecurObj.submissionId) && (subEndDate > eventRecurStartDate)) {
                                            return subEntry
                                        }
                                    });
                                    // Filter the recurring events data for entries that have the same ID & the new recurring event start date is before the already created recurring end date
                                    const recurFilteredData = recurringEvents.filter(subEntry => {
                                        let subEndDate = new Date(subEntry.endDateTime).setHours(23, 59, 59, 999);
                                        if ((subEntry.submissionId === eventRecurObj.submissionId) && (subEndDate > eventRecurStartDate)) {
                                            return subEntry
                                        }
                                    });
                                    // If there are no entries in either filtered dataset, add recurring event to list of created recurring events
                                    if ((submisFilteredData.length === 0) && (recurFilteredData.length === 0)) {
                                        recurringEvents.push(eventRecurObj);
                                    }
                                }
                            }
                            
                        } else {
                            // If the day date is after the event end date
                            if (dayOfRecurMonth.getTime() > endDate) {
                                // Take the submission event & create a recurring event if its on this date
                                const eventRecurObj = createRecurringEvent(submission, dayOfRecurMonth);
                                // If there is a recurring event
                                if (eventRecurObj !== "") {
                                    // Grab the start date of the recurring event
                                    const eventRecurStartDate = new Date(eventRecurObj.startDateTime).getTime();
                                    // Filter the submission data for entries that have the same submission ID & the recurring event start date is before the submission end date
                                    const submisFilteredData = filteredData.filter(subEntry => {
                                        let subEndDate = new Date(subEntry.endDateTime).setHours(23, 59, 59, 999);
                                        if ((subEntry.submissionId === eventRecurObj.submissionId) && (subEndDate > eventRecurStartDate)) {
                                            return subEntry
                                        }
                                    });
                                    // Filter the recurring events data for entries that have the same ID & the new recurring event start date is before the already created recurring end date
                                    const recurFilteredData = recurringEvents.filter(subEntry => {
                                        let subEndDate = new Date(subEntry.endDateTime).setHours(23, 59, 59, 999);
                                        if ((subEntry.submissionId === eventRecurObj.submissionId) && (subEndDate > eventRecurStartDate)) {
                                            return subEntry
                                        }
                                    });
                                    // If there are no entries in either filtered dataset, add recurring event to list of created recurring events
                                    if ((submisFilteredData.length === 0) && (recurFilteredData.length === 0)) {
                                        recurringEvents.push(eventRecurObj);
                                    }
                                }
                            }
                        }
                    }
                }
            });
            // Update the day of the calendar to the next day
            dayOfRecurMonth.setDate(dayOfRecurMonth.getDate() + 1);
        };
        // Combine the new recurring events list to the existing submissions entry ist
        filteredData = filteredData.concat(recurringEvents);
        // Returned the combined list of all events
        return filteredData
    }
    
    function filterCalendarEvents() {
        // Grab the text from the search bar
        const searchVal = $("#Calendar_SearchBar").val().toLowerCase();
        
        // Filter through each submission in the calendar data
        const filteredEvents = calendarData.filter((submission) => {
            
            // Grab the event name from the submission & transform it to all lower case
            const eventName = submission.eventName.toLowerCase();
            // Grab the event type from the submission & transform it to all lower case
            let eventType = submission.eventType.toLowerCase();
            
            // Grab the additional information from the submission & transform it to all lower case
            let addInfo = submission.additionalInformation.toLowerCase();

            // If the search value is anywhere in either of the 3 values, then it passes the filter
            return (eventName.includes(searchVal) || eventType.includes(searchVal) || addInfo.includes(searchVal))
            
        });
        
        // Take filtered dataset & pass into function to create reucrring events for this month
        const monthRecurEvents = createRecurringEvents(filteredEvents);
        
        // Return variable with all events
        return monthRecurEvents
    };
    
    // Function that builds the calendar display
    function displayCalendar() {
        // Grab the calendar events after filtering them for any seach bar inputs
        const filteredCalendarData = filterCalendarEvents();
        
        // Array that holds the days of the week (in USA standard with starting the week on Sunday)
        const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        
        // Get the current date then set to the first of the month for traversing through the different months
        let newDate = new Date();
        newDate = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
        
        // Grab the month value from the calendar (0 = current month)
        const monthDisplayEl = $("#Calendar_MonthDisplay");
        // From the element, grab the attribute to help know what month/year to display
        const monthNavVal = Number(monthDisplayEl.attr("navVal"));
        
        // Used when you aren't looking for the current month (when buttons are pressed) to naviagate to previous/next month
        if (monthNavVal != 0) {
            newDate.setMonth(new Date().getMonth() + monthNavVal);
        }
        
        // From the current date & time, grab the: 
        // Day of the month
        const newDate_Day = newDate.getDate();
        // Numerical month value (January = 1, August = 7, etc.)
        const newDate_Month = newDate.getMonth();
        // Year value
        const newDate_Year = newDate.getFullYear();
        
        // Using the current month & year values, grab the date of the first day of this month
        const firstDayOfMonth = new Date(newDate_Year, newDate_Month, 1);
        // The number of days in the current month
        // Month + 1, 0: get the number of days from the last day of last month to the first day of next month
        // Will be the number of squares rendered in table for this month days
        const daysInMonth = new Date(newDate_Year, newDate_Month + 1, 0).getDate();
        
        // From the first day of the month, grab the date string
        // Use American date format
        // Grab the long weekday name ("Tuesday"), numeric year value (2023), numeric month value (August = 7)
        //    and the numeric day value (22) -> ex. Tuesday, 8/1/2023
        const dateString = firstDayOfMonth.toLocaleDateString('en-us', {
            weekday: 'long',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        });
        
        // Use the day of the week from the dateString value to get the index of weekday
        const paddingDays = weekdays.indexOf(dateString.split(", ")[0]);
        
        // Display the month & year in the calendar header
        document.getElementById('Calendar_MonthDisplay').innerText = newDate.toLocaleDateString('en-us', {month: 'long'}) +" "+ newDate_Year;
        
        // Variable that will hold the HTML code to display the month's calendar
        let calendarDays = "";
        
        // Variable to compare current day to data events to pull each day's events into calendar display
        let nextDay = firstDayOfMonth;
        
        // Create variable that has today's date set in time format (used to determine which day in the calendar is today)
        let todaysDate = new Date();
        todaysDate = todaysDate.setHours(0, 0, 0, 0);
        
        let weekDayIndex = paddingDays - 1;
        
        // Track events added for the week
        let eventsAddedForWeek = {};
        // Track positions of long buttons
        let eventPositions = Array.from({ length: 7 }, () => []);
        
        let calendarEndDates = {};
        let calendarStartDates = {};
        filteredCalendarData.forEach(submission => {
            const startDate = submission.startDateTime;
            const endDate = submission.endDateTime;
            const eventName = submission.eventName;
            
            calendarStartDates[startDate] = calendarStartDates[startDate] || [];
            calendarEndDates[endDate] = calendarEndDates[endDate] || [];
            
            calendarStartDates[startDate].push(eventName);
            calendarEndDates[endDate].push(eventName);
        });
        
        let yesterdaysEvents = [];
        
        // Create day squares for padding days & days of the month
        for (let i = 1; i <= paddingDays + daysInMonth; i++) {
            // Start building the calendar display for this month's days
            if (i > paddingDays) {
            
                // Current Week Index
                if (weekDayIndex + 1 != 7) {
                    weekDayIndex = weekDayIndex + 1;
                } else {
                    weekDayIndex = 0;
                    
                    // Reset tracking for new week
                    eventsAddedForWeek = {};
                    eventPositions = Array.from({ length: 7 }, () => []);
                }
                
                let tempCount = 0;
                
                // Variable that determines if this day in the calendar is today or just another random day of the month
                let startDayEl = "";
                if (todaysDate === nextDay.setHours(0, 0, 0, 0)) {
                    startDayEl = "<div class='monthDayToday'>";
                } else {
                    startDayEl = "<div class='monthDay'>";
                }
                
                // Variable that will display the day of the monht (1, 2, 3... 29, 30, 31)
                const dayOfMonth = i - paddingDays;
                
                // Data filtered to only the calendar events for the current day of the month
                const todaysData = filteredCalendarData.filter(function(submission) {
                    // Set the start date/time variable from the response
                    const subStartDateTime = submission.startDateTime;
                    const testDateStart = new Date(subStartDateTime).setHours(0, 0, 0, 0);
                    // Set the end date/time variable from the response
                    const subEndDateTime = submission.endDateTime;
                    const testDateEnd = new Date(subEndDateTime).setHours(23, 59, 59, 999);
                    
                    // If the day of the month is on or after the start day & is on or before the end date, then it passes the filter
                    return (nextDay.getTime() >= testDateStart) && (nextDay.getTime() <= testDateEnd)
                });
                
                // If there are events that need to be placed in this day's calendar box
                if (todaysData.length > 0) {
                    // Sort the events for this day by the start date/time of each event (earliest day/time first)
                    todaysData.sort(function(a, b) {
                        startA = a.startDateTime;
                        compareA = new Date(startA).getTime();
                        startB = b.startDateTime;
                        compareB = new Date(startB).getTime();
                        
                        if (compareA > compareB) {
                            return 1
                        } else if (compareA < compareB)  {
                            return -1
                        } else {
                            return 0
                        }
                    });
                    
                    const maxEventCount = 5;
                    
                    // If there are 5 or less events in the day then you can go ahead & list all the events in the day's box
                    if (todaysData.length < maxEventCount) {
                        // Start adding the div to & day of the month to the calendar variable
                        calendarDays += startDayEl+
                            dayOfMonth+
                            todaysData.map((submission, index) => {
                                
                                // For each event in this day's box, grab the event name from the submission
                                const eventName = submission.eventName;
                                
                                // Grab the start date & time (with some formatting options)
                                const startDateTime = new Date(submission.startDateTime);
                                const startDate = startDateTime.toLocaleDateString('en-us', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                });
                                const startTime = startDateTime.toLocaleTimeString('en-us', {
                                    hour: "numeric",
                                    minute: "2-digit",
                                });
                                // Grab the end date & time (with some formatting options)
                                const endDateTime = new Date(submission.endDateTime);
                                const addEndDate = new Date(endDateTime).setHours(0, 0, 0, 0);
                                const endDate = endDateTime.toLocaleDateString('en-us', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                });
                                const endTime = endDateTime.toLocaleTimeString('en-us', {
                                    hour: "numeric",
                                    minute: "2-digit",
                                });
                                
                                let currentDate = new Date(newDate_Year, newDate_Month, dayOfMonth).getTime();
                                
                                const formattedCurrentDate = new Date(currentDate).toLocaleDateString('en-CA', {
                                            year: "numeric",
                                            month: "2-digit",
                                            day: "2-digit"
                                        });
                                const formattedEndDate = new Date(addEndDate).toLocaleDateString('en-CA', {
                                            year: "numeric",
                                            month: "2-digit",
                                            day: "2-digit"
                                        });
                                        
                                let todaysEvents = todaysData.map(submission => submission.eventName);
                                
                                if (index === 0) {
                                    yesterdaysEvents = (weekDayIndex === 0) ? [] : yesterdaysEvents;
                                    
                                    if (yesterdaysEvents.length > (maxEventCount - 1)) {
                                        if (weekDayIndex == 0) {
                                            yesterdaysEvents = [];
                                        }
                                        let tempKeys;
                                        tempKeys = yesterdaysEvents.slice((maxEventCount - 1) - yesterdaysEvents.length);
                                        tempKeys.forEach(key => {
                                            if (eventsAddedForWeek[key]) {
                                                delete eventsAddedForWeek[key];
                                            }
                                        })
                                    }
                                }
                                
                                yesterdaysEvents = todaysEvents;
                                
                                if (!eventsAddedForWeek[eventName]) {
                                    // Mark event as added for this week
                                    eventsAddedForWeek[eventName] = true;
                                } else {
                                    if (formattedCurrentDate === formattedEndDate) {
                                        delete eventsAddedForWeek[eventName];
                                    }
                                    
                                    let tempDiv = ""
                                    while(eventPositions[weekDayIndex].includes(tempCount)) {
                                        tempDiv += "<div class='dayEvent eventType_' style='width: 100%; visibility: hidden;'></div>";
                                        tempCount += 1;
                                    }
                                    return tempDiv;
                                }
                                
                                // Grab the event type, if that question was answered
                                let eventType = submission.eventType;
                                
                                // Grab the additional information, if that question was answered
                                let additionalInfo = submission.additionalInformation;
                                
                                // Grab the recurring time frame, if that question was answered
                                let recurTimeFrame = submission.timeFrame;
                                
                                // Grab the end recurring date, if that question was answered
                                let recurEndDate = "";

                                if (submission.endRecurring != "") {
                                    recurEndDate = new Date(submission.endRecurring).setHours(0, 0, 0, 0) + 86400000;
                                    recurEndDate = new Date(recurEndDate).toLocaleDateString('en-us', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    });
                                }
                                
                                // Create the event text that will display on the calendar
                                let eventIconName = "";
                                // If this box's day is the same date as the start event date, include the start time
                                if (startDateTime.getDate() === nextDay.getDate()) {
                                    eventIconName = startTime+" "+eventName;
                                } else {
                                    // If not, only display the event name
                                    eventIconName = eventName;
                                }
                                
                                let span = 7 - weekDayIndex;
                                
                                if (calendarEndDates[formattedCurrentDate]) {
                                    for (const event of calendarEndDates[formattedCurrentDate]) {
                                        delete eventsAddedForWeek[event];
                                    }
                                }
                                
                                const timeDifference = Math.abs(currentDate - addEndDate); // Use Math.abs to ensure positive difference
                                const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
                                
                                span = (span > daysDifference) ? (daysDifference + 1) : span;
                                span = (span > (paddingDays + daysInMonth - i + 1)) ? (paddingDays + daysInMonth - i + 1) : span;
                                
                                let tempDiv = "";
                                while(eventPositions[weekDayIndex].includes(tempCount)) {
                                    tempDiv += "<div class='dayEvent eventType_' style='width: 100%; visibility: hidden;'></div>";
                                    tempCount += 1;
                                }
                                
                                if (tempCount < (maxEventCount - 1)) {
                                    for (let j = 0; j < span; j++) {
                                        eventPositions[weekDayIndex + j].push(tempCount);
                                    }
                                }
                                
                                tempCount += 1;
                                
                                // Add all the relevant information to the day's display (event icon & pop up modal with more information)
                                return tempDiv + "<div class='dayEvent eventType_"+eventType+"' data-toggle='modal' data-target='#Event_"+submission.submissionId+"_"+nextDay.getTime() + "' style='width: calc((100% + 20px) * " + span + " - 20px);'>"+
                                    eventIconName+
                                "</div>"+
                                "<div class='modal fade' id='Event_"+submission.submissionId+"_"+nextDay.getTime()+"' tabindex='-1' role='dialog' aria-labelledby='calendarModal' aria-hidden='true'>"+
                                    "<div class='modal-dialog' role='document'>"+
                                        "<div class='modal-content'>"+
                                            "<div class='modal-header'>"+
                                                "<h5 class='modal-title'>"+eventName+"</h5>"+
                                                "<button type='button' class='close' data-dismiss='modal' aria-label='Close'>"+
                                                    "<span aria-hidden='true'>&times;</span>"+
                                                "</button>"+
                                            "</div>"+
                                            "<div class='modal-body'>"+
                                                "<p><b>Start Date/Time: </b>"+startDate+", "+startTime+
                                                "<br><b>End Date/Time:   </b>"+endDate+", "+endTime+
                                                "<br><b>Event Type: </b>"+eventType+
                                                "<br><b>Recurring Timeframe: </b>"+recurTimeFrame+
                                                "<br><b>End of Event Recurring: </b>"+recurEndDate+
                                                "<br><b>Aditional Information: </b><br>"+additionalInfo+"</p>"+
                                                "<p style='text-align: right;'><button id='view_"+submission.submissionId+"_"+nextDay.getTime()+"_button' class='btn btn-sm submission-calendar-modal-btn' style='text-align: left;'>View Full Details</button></p>"+
                                            "</div>"+
                                        "</div>"+
                                    "</div>"+
                                "</div>"
                            }).join('')+
                        "</div>";
                        
                    // If there are more that 5 events for this day, then display the first 4 & put all other events in a pop up modal    
                    } else {
                        // Just like before, start adding the day of the month div to the calendar display element
                        calendarDays += startDayEl+
                            dayOfMonth+
                            todaysData.map((submission, index) => {
                                
                                // For each event in this day's box, grab the event name from the submission
                                const eventName = submission.eventName;
                                
                                // Grab the start date & time (with some formatting options)
                                const startDateTime = new Date(submission.startDateTime);
                                const startDate = startDateTime.toLocaleDateString('en-us', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                });
                                const startTime = startDateTime.toLocaleTimeString('en-us', {
                                    hour: "numeric",
                                    minute: "2-digit",
                                });
                                // Grab the end date & time (with some formatting options)
                                const endDateTime = new Date(submission.endDateTime);
                                const addEndDate = new Date(endDateTime).setHours(0, 0, 0, 0);
                                const endDate = endDateTime.toLocaleDateString('en-us', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                });
                                const endTime = endDateTime.toLocaleTimeString('en-us', {
                                    hour: "numeric",
                                    minute: "2-digit",
                                });
                                
                                let currentDate = new Date(newDate_Year, newDate_Month, dayOfMonth).getTime();
                                
                                const formattedCurrentDate = new Date(currentDate).toLocaleDateString('en-CA', {
                                            year: "numeric",
                                            month: "2-digit",
                                            day: "2-digit"
                                        });
                                const formattedEndDate = new Date(addEndDate).toLocaleDateString('en-CA', {
                                            year: "numeric",
                                            month: "2-digit",
                                            day: "2-digit"
                                        });
                                        
                                let todaysEvents = todaysData.map(submission => submission.eventName);
                                
                                if (index === 0) {
                                    yesterdaysEvents = (weekDayIndex === 0) ? [] : yesterdaysEvents;
                                    
                                    if (yesterdaysEvents.length > (maxEventCount - 1)) {
                                        if (weekDayIndex == 0) {
                                            yesterdaysEvents = [];
                                        }
                                        let tempKeys;
                                        tempKeys = yesterdaysEvents.slice((maxEventCount - 1) - yesterdaysEvents.length);
                                        tempKeys.forEach(key => {
                                            if (eventsAddedForWeek[key]) {
                                                delete eventsAddedForWeek[key];
                                            }
                                        })
                                    }
                                }
                                
                                yesterdaysEvents = todaysEvents;
                                
                                if (!eventsAddedForWeek[eventName]) {
                                    // Mark event as added for this week
                                    eventsAddedForWeek[eventName] = true;
                                } else {
                                    if (formattedCurrentDate === formattedEndDate) {
                                        delete eventsAddedForWeek[eventName];
                                    }
                                    
                                    let tempDiv = ""
                                    while(eventPositions[weekDayIndex].includes(tempCount)) {
                                        tempDiv += "<div class='dayEvent eventType_' style='width: 100%; visibility: hidden;'></div>";
                                        tempCount += 1;
                                    }

                                    if (index === todaysData.length - 1) {
                                        tempDiv = "</div></div></div></div>";
                                    }

                                    return tempDiv;
                                }
                                
                                // Grab the event type, if that question was answered
                                let eventType = submission.eventType;
                                
                                // Grab the additional information, if that question was answered
                                let additionalInfo = submission.additionalInformation;
                                
                                // Grab the recurring time frame, if that question was answered
                                let recurTimeFrame = submission.timeFrame;
                                
                                // Grab the end recurring date, if that question was answered
                                let recurEndDate = "";

                                if (submission.endRecurring != "") {
                                    recurEndDate = new Date(submission.endRecurring).setHours(0, 0, 0, 0) + 86400000;
                                    recurEndDate = new Date(recurEndDate).toLocaleDateString('en-us', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    });
                                }
                                
                                // Create the event text that will display on the calendar
                                let eventIconName = "";
                                // If this box's day is the same date as the start event date, include the start time
                                if (startDateTime.getDate() === nextDay.getDate()) {
                                    eventIconName = startTime+" "+eventName;
                                } else {
                                    // If not, only display the event name
                                    eventIconName = eventName;
                                }
                                
                                let span = 7 - weekDayIndex;
                                
                                if (calendarEndDates[formattedCurrentDate]) {
                                    for (const event of calendarEndDates[formattedCurrentDate]) {
                                        delete eventsAddedForWeek[event];
                                    }
                                }
                                
                                const timeDifference = Math.abs(currentDate - addEndDate); // Use Math.abs to ensure positive difference
                                const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
                                
                                span = (span > daysDifference) ? (daysDifference + 1) : span;
                                span = (span > (paddingDays + daysInMonth - i + 1)) ? (paddingDays + daysInMonth - i + 1) : span;
                                
                                let tempDiv = "";
                                while(eventPositions[weekDayIndex].includes(tempCount)) {
                                    tempDiv += "<div class='dayEvent eventType_' style='width: 100%; visibility: hidden;'></div>";
                                    tempCount += 1;
                                }
                                
                                if (tempCount < (maxEventCount - 1)) {
                                    for (let j = 0; j < span; j++) {
                                        eventPositions[weekDayIndex + j].push(tempCount);
                                    }
                                }
                                
                                tempCount += 1;
                                
                                // For the first 4 events, create the event icon just as before with all relevant data displayed
                                // index values start counting at 0, so 0, 1, 2, 3 index values are the first 4 events (index 4 means the 5th event)
                                if (index < (maxEventCount - 1)) {
                                    return tempDiv + "<div class='dayEvent eventType_"+eventType+"' data-toggle='modal' data-target='#Event_"+submission.submissionId+"_"+nextDay.getTime()+"' style='width: calc((100% + 20px) * " + span + " - 20px);'>"+
                                        eventIconName+
                                    "</div>"+
                                    "<div class='modal fade' id='Event_"+submission.submissionId+"_"+nextDay.getTime()+"' tabindex='-1' role='dialog' aria-labelledby='calendarModal' aria-hidden='true'>"+
                                        "<div class='modal-dialog' role='document'>"+
                                            "<div class='modal-content'>"+
                                                "<div class='modal-header'>"+
                                                    "<h5 class='modal-title'>"+eventName+"</h5>"+
                                                    "<button type='button' class='close' data-dismiss='modal' aria-label='Close'>"+
                                                        "<span aria-hidden='true'>&times;</span>"+
                                                    "</button>"+
                                                "</div>"+
                                                "<div class='modal-body'>"+
                                                    "<p><b>Start Date/Time: </b>"+startDate+", "+startTime+
                                                    "<br><b>End Date/Time:   </b>"+endDate+", "+endTime+
                                                    "<br><b>Event Type: </b>"+eventType+
                                                    "<br><b>Recurring Timeframe: </b>"+recurTimeFrame+
                                                    "<br><b>End of Event Recurring: </b>"+recurEndDate+
                                                    "<br><b>Aditional Information: </b><br>"+additionalInfo+"</p>"+
                                                    "<p style='text-align: right;'>" +
                                                        "<button id='view_"+submission.submissionId+"_"+nextDay.getTime()+"_button' class='btn btn-sm submission-calendar-modal-btn' style='text-align: left;'>View Full Details</button>" + 
                                                    "</p>"+
                                                "</div>"+
                                            "</div>"+
                                        "</div>"+
                                    "</div>"
                                    
                                // For the 5th, create a calendar event that shows the number of other events to be displayed in one pop up modal  
                                } else if (index === (maxEventCount - 1)) {
                                    const closingDivs = (index === todaysData.length - 1) ? "</div></div></div></div>" : "";
                                    const numEventsLeft = todaysData.length - (maxEventCount - 1);
                                    
                                    // Start the pop up modal by adding in the 5th event for this day
                                    return tempDiv + "<div class='dayEvent eventType_' data-toggle='modal' data-target='#Event_ExtraEvents_"+nextDay.getTime()+"'>"+
                                        "+"+numEventsLeft+" events"+
                                    "</div>"+
                                    "<div class='modal fade' id='Event_ExtraEvents_"+nextDay.getTime()+"' tabindex='-1' role='dialog' aria-labelledby='calendarModal' aria-hidden='true'>"+
                                        "<div class='modal-dialog' role='document'>"+
                                            "<div class='modal-content'>"+
                                                "<div class='modal-header'>"+
                                                    "<h5 class='modal-title'>+"+numEventsLeft+" Events</h5>"+
                                                    "<button type='button' class='close' data-dismiss='modal' aria-label='Close'>"+
                                                        "<span aria-hidden='true'>&times;</span>"+
                                                    "</button>"+
                                                "</div>"+
                                                "<div class='modal-body'>"+
                                                    "<h5>"+eventName+"</h5>"+
                                                    "<hr class='solid' style='margin: 3px;'>"+
                                                    "<p><b>Start Date/Time: </b>"+startDate+", "+startTime+
                                                    "<br><b>End Date/Time:   </b>"+endDate+", "+endTime+
                                                    "<br><b>Event Type: </b>"+eventType+
                                                    "<br><b>Recurring Timeframe: </b>"+recurTimeFrame+
                                                    "<br><b>End of Event Recurring: </b>"+recurEndDate+
                                                    "<br><b>Aditional Information: </b><br>"+additionalInfo+"</p>"+
                                                    "<p style='text-align: right;'><button id='view_"+submission.submissionId+"_"+nextDay.getTime()+"_button' class='btn btn-sm submission-calendar-modal-btn' style='text-align: left;'>View Full Details</button></p>"+
                                                    closingDivs;
                                                
                                // If the index is for the last event of the day                
                                }  else if (index === todaysData.length - 1) {
                                    // Add the event information to the pop up modal & close the divs for the modal
                                    return "<h5>"+eventName+"</h5>"+
                                        "<hr class='solid' style='margin: 3px;'>"+
                                        "<p><b>Start Date/Time: </b>"+startDate+", "+startTime+
                                        "<br><b>End Date/Time:   </b>"+endDate+", "+endTime+
                                        "<br><b>Event Type: </b>"+eventType+
                                        "<br><b>Recurring Timeframe: </b>"+recurTimeFrame+
                                        "<br><b>End of Event Recurring: </b>"+recurEndDate+
                                        "<br><b>Aditional Information: </b><br>"+additionalInfo+
                                        "<p style='text-align: right;'><button id='view_"+submission.submissionId+"_"+nextDay.getTime()+"_button' class='btn btn-sm submission-calendar-modal-btn' style='text-align: left;'>View Full Details</button></p>"+
                                    "</div>"+
                                    "</div>"+
                                    "</div>"+
                                    "</div>"
                                
                                // For all other days in the pop up modal  
                                } else {
                                    // Add the relevant information to the pop up modal
                                    return "<h5>"+eventName+"</h5>"+
                                        "<hr class='solid' style='margin: 3px;'>"+
                                        "<p><b>Start Date/Time: </b>"+startDate+", "+startTime+
                                        "<br><b>End Date/Time:   </b>"+endDate+", "+endTime+
                                        "<br><b>Event Type: </b>"+eventType+
                                        "<br><b>Recurring Timeframe: </b>"+recurTimeFrame+
                                        "<br><b>End of Event Recurring: </b>"+recurEndDate+
                                        "<br><b>Aditional Information: </b><br>"+additionalInfo+"</p>"+
                                        "<p style='text-align: right;'><button id='view_"+submission.submissionId+"_"+nextDay.getTime()+"_button' class='btn btn-sm submission-calendar-modal-btn' style='text-align: left;'>View Full Details</button></p>"
                                }
                            }).join('')+
                        "</div>";
                    }
                    
                // If there are no events for this day of the month        
                } else {
                    // Create the empty day of the month box that just has the day number
                    calendarDays += startDayEl+dayOfMonth+"</div>";
                }
                // Update the nextDay variable to the next day of the month
                nextDay.setDate(nextDay.getDate() + 1);
            
            // If I has not gotten to the days of the month, add padding days so the first day of the month box corresponds to that day of the week
            } else {
                calendarDays += "<div class='monthDay paddingDay'></div>";
            }
        };
        
        // Display the calendar variable in the calendar element created in the HTML
        document.getElementById('Calendar_CalendarDisplay').innerHTML = calendarDays;
        
        findSubmissionBtns();
    }
    
    // Function that fetches the data from the API instead of using the Freemarker list to grab them one by one
    // Only update needed to this function is to change the 'formId=' to whichever form the new calendar is going to be copied to
    function fetchData() {
        return fetch('data/calendarData.json')
            .then(function (response) {
                if (response.status === 200) {
                    return response.json();
                }
            })
            .catch(function (error) {
                console.log(error);
                document.getElementById('Calendar_CalendarDisplay').innerHTML = 'Error loading data...';
            });
    }
    
    // Function that increases the month value & moves the calendar to the next month
    function moveToNextMonth() {
        // Grab the month value from the calendar (0 = current month)
        const monthDisplayEl = $("#Calendar_MonthDisplay");
        let monthNavVal = Number(monthDisplayEl.attr("navVal"));
        // Add 1 to the month value (1 = next month, 2 = 2 months from now, etc.)
        monthNavVal++;
        // Add the value back to the attribute in the calendar HTML
        monthDisplayEl.attr("navVal", monthNavVal);
        // Call the function to build the new calendar view for the next month
        displayCalendar();
    }
    
    // Function that increases the month value & moves the calendar to the next month
    function moveToPrevMonth() {
        // Grab the month value from the calendar (0 = current month)
        const monthDisplayEl = $("#Calendar_MonthDisplay");
        let monthNavVal = Number(monthDisplayEl.attr("navVal"));
        // Subtract 1 to the month value (-1 = previous month, -2 = 2 months previous, etc.)
        monthNavVal--;
        // Add the value back to the attribute in the calendar HTML
        monthDisplayEl.attr("navVal", monthNavVal);
        // Call the function to build the new calendar view for the previous month
        displayCalendar();
    }
    
    
    async function init() {
        // Fetch the data from the form, wait until all the data has been fetched before proceeding
        calendarData = await fetchData();
        
        // Wait for the template to finish rendering before grabing the top ID
        const topLevelElement = await waitForTopLevelElement();
        
        // Grab the month value from the calendar (0 = current month)
        const monthDisplayEl = topLevelElement.find("#Calendar_MonthDisplay");
        const monthNavVal = Number(monthDisplayEl.attr("navVal"));
        
        // Call the function to build the calendar view for the current month
        displayCalendar();
        
        // Grab the next & previous month buttons
        const nextMonthBtn = topLevelElement.find("#Calendar_NextMonthBtn");
        const prevMonthBtn = topLevelElement.find("#Calendar_PrevMonthBtn");
        
        // Add event handlers to move between months based on which buttons are clicked
        addEventHandler(nextMonthBtn, "click", moveToNextMonth);
        addEventHandler(prevMonthBtn, "click", moveToPrevMonth);
        
        // Grab the search bar
        const searchBarEl = topLevelElement.find("#Calendar_SearchBar");
        
        // Add event listeners that calls the function to build the calendar display after filtering the data
        // The call will wait 0.5s after the final keyup value is inputted to prevent continual filtering
        addEventHandler(searchBarEl, "keyup", vanillaDebounce(displayCalendar, 500));
        
        configureCleanup();
    }
    
    init();
})();