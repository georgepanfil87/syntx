import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppearanceSection } from './appearance-section';

describe('AppearanceSection', () => {
  let component: AppearanceSection;
  let fixture: ComponentFixture<AppearanceSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppearanceSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppearanceSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
