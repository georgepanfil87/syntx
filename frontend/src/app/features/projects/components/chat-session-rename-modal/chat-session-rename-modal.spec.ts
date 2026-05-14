import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatSessionRenameModal } from './chat-session-rename-modal';

describe('ChatSessionRenameModal', () => {
  let component: ChatSessionRenameModal;
  let fixture: ComponentFixture<ChatSessionRenameModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatSessionRenameModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatSessionRenameModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
