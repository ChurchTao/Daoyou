import { TagAddedEvent, TagRemovedEvent, BuffAddEvent, EventPriorityLevel } from './core/events';

// Test that types are properly exported
const eventType1: TagAddedEvent['type'] = 'TagAddedEvent';
const eventType2: TagRemovedEvent['type'] = 'TagRemovedEvent';
const eventType3: BuffAddEvent['type'] = 'BuffAddEvent';

// Test priority levels exist
const buffIntercept = EventPriorityLevel.BUFF_INTERCEPT;
const tagChange = EventPriorityLevel.TAG_CHANGE;

console.log('TagAddedEvent type:', eventType1);
console.log('TagRemovedEvent type:', eventType2);
console.log('BuffAddEvent type:', eventType3);
console.log('BUFF_INTERCEPT priority:', buffIntercept);
console.log('TAG_CHANGE priority:', tagChange);
console.log('All event types and priorities defined successfully!');
