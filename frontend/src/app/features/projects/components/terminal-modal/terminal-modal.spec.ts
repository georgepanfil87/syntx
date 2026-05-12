import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TerminalModal } from './terminal-modal';

describe('TerminalModal', () => {
  let component: TerminalModal;
  let fixture: ComponentFixture<TerminalModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminalModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TerminalModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
