import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiEditModal } from './ai-edit-modal';

describe('AiEditModal', () => {
  let component: AiEditModal;
  let fixture: ComponentFixture<AiEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiEditModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
