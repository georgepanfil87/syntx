import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatComposer } from './chat-composer';

describe('ChatComposer', () => {
  let component: ChatComposer;
  let fixture: ComponentFixture<ChatComposer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatComposer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatComposer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
