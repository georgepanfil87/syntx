import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplyDiffModal } from './apply-diff-modal';

describe('ApplyDiffModal', () => {
  let component: ApplyDiffModal;
  let fixture: ComponentFixture<ApplyDiffModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplyDiffModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplyDiffModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
