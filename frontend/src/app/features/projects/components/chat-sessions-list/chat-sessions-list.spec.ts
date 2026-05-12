import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatSessionsList } from './chat-sessions-list';

describe('ChatSessionsList', () => {
  let component: ChatSessionsList;
  let fixture: ComponentFixture<ChatSessionsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatSessionsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatSessionsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
