import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatPane } from './chat-pane';

describe('ChatPane', () => {
  let component: ChatPane;
  let fixture: ComponentFixture<ChatPane>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatPane]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatPane);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
