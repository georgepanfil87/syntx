import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Resizer } from './resizer';

describe('Resizer', () => {
  let component: Resizer;
  let fixture: ComponentFixture<Resizer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Resizer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Resizer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
