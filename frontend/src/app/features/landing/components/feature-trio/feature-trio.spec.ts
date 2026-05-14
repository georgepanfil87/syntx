import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeatureTrio } from './feature-trio';

describe('FeatureTrio', () => {
  let component: FeatureTrio;
  let fixture: ComponentFixture<FeatureTrio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureTrio]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeatureTrio);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
